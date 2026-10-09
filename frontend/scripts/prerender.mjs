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
 */
import {spawnSync} from "node:child_process";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
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

console.log(`[prerender] 使用 ${chrome}`);

const result = spawnSync(chrome, [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--virtual-time-budget=10000",
    "--dump-dom",
    `file://${INDEX}`
], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});

// dbus / 容器内的噪声日志不算错误
const stderr = (result.stderr || "")
    .split("\n")
    .filter((line) => line && !/dbus|Failed to connect to the bus|DevTools listening|GCM|voice_transcription/i.test(line));

if (result.status !== 0 || !result.stdout || result.stdout.length < 200) {
    console.error("[prerender] 渲染失败，保留未预渲染的 index.html 供排查");
    if (stderr.length) {
        console.error(stderr.slice(0, 8).join("\n"));
    }
    process.exit(1);
}

writeFileSync(INDEX, result.stdout);

console.log(`[prerender] 完成：dist/index.html ${before} → ${result.stdout.length} 字节`);
