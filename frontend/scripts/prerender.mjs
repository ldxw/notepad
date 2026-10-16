#!/usr/bin/env node
/**
 * 把构建出来的 SPA 首页预渲染成静态 HTML（给搜索引擎看）。
 *
 * 用的是官方 Chrome for Testing 的 chrome-headless-shell + --dump-dom：
 *   - x64 和 arm64 都有官方二进制，两种架构行为一致
 *   - 不依赖 puppeteer（原来那套是 puppeteer@1.20 / 2019 年，只有 x86_64 版，arm64 上必然失败）
 *
 * Chrome 的位置按顺序找：$CHROME_BIN → frontend/.chrome/chrome-headless-shell → 常见系统路径。
 * 找不到就跳过并提示（本地开发不必为了构建去装浏览器），找到就正常预渲染。
 *
 * 渲染用的界面语言取自 $SITE_LANG（构建参数）：前端选语言的优先级是
 * localStorage → <meta name="default-locale"> → navigator.language，
 * 无头环境里前两者都没有，不指定就会渲染成英文。这里在渲染用的临时副本里注入
 * 一条带标记的 default-locale，渲染完再从产物里删掉 —— 镜像里的静态 HTML 是目标语言，
 * 运行时的行为（容器里的 SITE_LANG / 访客浏览器语言）完全不变。
 */
import {spawnSync} from "node:child_process";
import {existsSync, readFileSync, unlinkSync, writeFileSync} from "node:fs";
import path from "node:path";
import process from "node:process";

const INDEX = path.resolve("dist", "index.html");

const candidates = [
    process.env.CHROME_BIN,
    path.resolve(".chrome", "chrome-headless-shell"),
    "/usr/local/bin/chrome-headless-shell",
    "/usr/bin/chrome-headless-shell",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
].filter(Boolean);

const chrome = candidates.find((p) => existsSync(p));

if (!chrome) {
    console.warn("[prerender] 未找到 Chrome/Chromium，跳过预渲染（可用 CHROME_BIN 指定路径）");
    process.exit(0);
}

if (!existsSync(INDEX)) {
    console.error("[prerender] 找不到 dist/index.html —— 请先运行 webpack");
    process.exit(1);
}

const before = readFileSync(INDEX, "utf8").length;

// 预渲染用的界面语言：SITE_LANG 以 zh / en 开头时生效，其余（没设、auto）保持原行为（无头浏览器默认）
const wanted = String(process.env.SITE_LANG || "").trim().toLowerCase();

const PRERENDER_LANG = wanted.startsWith("zh") ? "zh" : (wanted.startsWith("en") ? "en" : "");

const MARKER = ' data-prerender-only=""';

const RENDER_INDEX = PRERENDER_LANG ? path.resolve("dist", ".index.prerender.html") : INDEX;

if (PRERENDER_LANG) {

    const html = readFileSync(INDEX, "utf8");
    const tag = `<meta name="default-locale" content="${PRERENDER_LANG}"${MARKER}>`;

    writeFileSync(RENDER_INDEX, /<head[^>]*>/i.test(html)
        ? html.replace(/(<head[^>]*>)/i, (match) => match + "\n    " + tag)
        : html);

    console.log(`[prerender] 按 SITE_LANG=${PRERENDER_LANG} 渲染`);
}

console.log(`[prerender] 使用 ${chrome}`);

// --no-zygote / --single-process：多架构构建里 arm64 那条腿是 QEMU 模拟执行，
// Chrome 的多进程架构（zygote / GPU 子进程）在模拟环境下起不来，会报
// "Did not receive ping from zygote child" / "GPU process launch failed"，然后渲染失败。
// 单进程模式可以绕开这个问题，对一次性的 --dump-dom 渲染没有副作用。
const result = spawnSync(chrome, [
    "--no-sandbox",
    "--no-zygote",
    "--single-process",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    ...(PRERENDER_LANG ? [`--lang=${PRERENDER_LANG === "zh" ? "zh-CN" : "en-US"}`] : []),
    "--virtual-time-budget=10000",
    "--dump-dom",
    `file://${RENDER_INDEX}`
], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});

// dbus / 容器内的噪声日志不算错误
const stderr = (result.stderr || "")
    .split("\n")
    .filter((line) => line && !/dbus|Failed to connect to the bus|DevTools listening|GCM|voice_transcription/i.test(line));

if (PRERENDER_LANG && existsSync(RENDER_INDEX)) {
    try {
        unlinkSync(RENDER_INDEX);
    } catch {
        // 清理失败不影响结果
    }
}

if (result.status !== 0 || !result.stdout || result.stdout.length < 200) {
    console.error("[prerender] 渲染失败，保留未预渲染的 index.html 供排查");
    if (stderr.length) {
        console.error(stderr.slice(0, 8).join("\n"));
    }
    process.exit(1);
}

// 去掉只给预渲染用的那条 meta：产物里不留额外标记，运行时语言仍由容器环境决定
const output = PRERENDER_LANG
    ? result.stdout.replace(new RegExp('\\s*<meta name="default-locale" content="[^"]*"' + MARKER + '>'), "")
    : result.stdout;

writeFileSync(INDEX, output);

console.log(`[prerender] 完成：dist/index.html ${before} → ${output.length} 字节`
    + (PRERENDER_LANG ? `（界面语言 ${PRERENDER_LANG}）` : ""));
