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
 * 渲染用的界面语言取自 $SITE_LANG（构建参数），可以是单个语言或逗号分隔的多个（如 "zh,en"）：
 *   · 单个 zh / en  → 渲染一份，同时写入 dist/index.html
 *   · 多个 zh,en    → 每种语言各渲染一份 dist/index.<lang>.html，第一份同时写入 dist/index.html；
 *                     服务端再按访客的 Accept-Language 挑对应那份（见 backend/src/Server.ts）
 *   · 没设 / auto   → 保持原行为：渲染一份，语言交给无头浏览器的默认值
 *
 * 前端选语言的优先级是 localStorage → <meta name="default-locale"> → navigator.language，
 * 无头环境里前两者都没有，不指定就会渲染成英文。所以渲染前往临时副本注入一条带标记的
 * default-locale 并给 Chrome 加 --lang，渲染完再把注入的 meta 从产物里删掉 ——
 * 产物里不留额外标记，运行时的语言仍由容器环境和请求决定。
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

// 想渲染哪几套语言（去重，只认 zh / en）
const wanted = String(process.env.SITE_LANG || "").trim().toLowerCase();

const PRERENDER_LANGS = [...new Set(wanted.split(/[\s,]+/)
    .map((one) => one.startsWith("zh") ? "zh" : (one.startsWith("en") ? "en" : ""))
    .filter(Boolean))];

const MARKER = ' data-prerender-only=""';

// dbus / 容器内的噪声日志不算错误
const cleanStderr = (raw) => (raw || "").split("\n")
    .filter((line) => line && !/dbus|Failed to connect to the bus|DevTools listening|GCM|voice_transcription/i.test(line));

// --no-zygote / --single-process：多架构构建里 arm64 那条腿是 QEMU 模拟执行，
// Chrome 的多进程架构（zygote / GPU 子进程）在模拟环境下起不来，会报
// "Did not receive ping from zygote child" / "GPU process launch failed"，然后渲染失败。
// chrome-headless-shell 本身就是单进程形态，这两个参数对它没影响；
// 完整 Chromium 则不然：2026 年起 --headless 旧开关被移除，不带 --headless=new
// 会尝试起 X 会话挂死，且新无头模式下 --single-process 直接 SIGTRAP 崩溃。
// 所以完整 Chromium 走 --headless=new 并剥离 --single-process（保留 --no-zygote 无害）。
const isFullChromium = !/chrome-headless-shell/.test(chrome);

const BASE_ARGS = [
    "--no-sandbox",
    "--no-zygote",
    "--single-process",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--virtual-time-budget=10000",
    "--dump-dom"
];

const chromeArgs = () => {
    if (!isFullChromium) {
        return BASE_ARGS;
    }
    return ["--headless=new",
        ...BASE_ARGS.filter((arg) => arg !== "--single-process")];
};

// file:// 加载时绝对路径资源（src="/bundle.js"）指向文件系统根，解析不到，
// 页面 JS 不执行、渲染出来仍是空壳。渲染前把绝对路径临时改写成相对路径
//（文件与 dist 同目录），渲染完的产物再换回绝对路径 —— 线上仍是 / 绝对引用。
const relativize = (html) => html
    .replace(/(src|href)="\/([^\/"])/g, '$1="./$2');

const absolutize = (html) => html
    .replace(/(src|href)="\.\//g, '$1="/');

const fail = (label, stderr) => {
    console.error(`[prerender] ${label}渲染失败，保留未预渲染的 index.html 供排查`);
    if (stderr && stderr.length) {
        console.error(stderr.slice(0, 8).join("\n"));
    }
    process.exit(1);
};

/** 渲染一份指定语言的静态 HTML；失败时返回 {ok: false, stderr} */
function renderLang(html, lang) {

    const tmp = path.resolve("dist", `.index.prerender.${lang}.html`);

    const tag = `<meta name="default-locale" content="${lang}"${MARKER}>`;

    writeFileSync(tmp, relativize(/<head[^>]*>/i.test(html)
        ? html.replace(/(<head[^>]*>)/i, (match) => match + "\n    " + tag)
        : html));

    const out = spawnSync(chrome, [
        ...chromeArgs().slice(0, -1),
        `--lang=${lang === "zh" ? "zh-CN" : "en-US"}`,
        "--dump-dom",
        `file://${tmp}`
    ], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});

    try {
        unlinkSync(tmp);
    } catch {
        // 清理失败不影响结果
    }

    if (out.status !== 0 || !out.stdout || out.stdout.length < 200) {
        return {ok: false, stderr: cleanStderr(out.stderr)};
    }

    // 去掉只给预渲染用的那条 meta，资源引用换回线上的绝对路径
    return {
        ok: true,
        html: absolutize(out.stdout.replace(new RegExp('\\s*<meta name="default-locale" content="[^"]*"' + MARKER + '>'), ""))
    };
}

console.log(`[prerender] 使用 ${chrome}`);

// 没指定语言：按老办法渲染一份，语言交给无头浏览器默认值。
// 同样走临时副本（relativize 后 file:// 才能加载到 bundle.js）
if (!PRERENDER_LANGS.length) {

    const tmpNoLang = path.resolve("dist", ".index.prerender.html");
    writeFileSync(tmpNoLang, relativize(readFileSync(INDEX, "utf8")));

    const rendered = spawnSync(chrome, [...chromeArgs(), `file://${tmpNoLang}`], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});

    try {
        unlinkSync(tmpNoLang);
    } catch {
        // 清理失败不影响结果
    }

    if (rendered.status !== 0 || !rendered.stdout || rendered.stdout.length < 200) {
        fail("", cleanStderr(rendered.stderr));
    }

    const html = absolutize(rendered.stdout);
    writeFileSync(INDEX, html);

    console.log(`[prerender] 完成：dist/index.html ${before} → ${html.length} 字节`);
    process.exit(0);
}

console.log(`[prerender] 语言：${PRERENDER_LANGS.join(" / ")}`);

const source = readFileSync(INDEX, "utf8");

PRERENDER_LANGS.forEach((lang, index) => {

    const result = renderLang(source, lang);

    if (!result.ok) {
        fail(`${lang} `, result.stderr);
    }

    writeFileSync(path.resolve("dist", `index.${lang}.html`), result.html);

    // 第一份同时写进默认的 index.html（服务端挑不到对应语言时兜底）
    if (index === 0) {
        writeFileSync(INDEX, result.html);
    }

    console.log(`[prerender] ${lang} → dist/index.${lang}.html（${result.html.length} 字节）`);
});

console.log(`[prerender] 完成：${PRERENDER_LANGS.join(" / ")}，默认 index.html 用 ${PRERENDER_LANGS[0]}`);
