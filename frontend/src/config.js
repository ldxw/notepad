// ── 运行时可覆盖的配置 ──────────────────────────────────────────────────────
// 容器启动时 backend/src/SiteMeta.ts 会把环境变量注入成 <meta>，这里在模块加载时读取；
// 读不到（预渲染阶段、纯静态打开、或没设变量）就用下面的默认值。
// 也就是说这些值改完重启容器即可生效，不需要重新构建镜像。

/** 读取注入的 <meta name="..."> 的 content；拿不到就返回空串 */
function injected(name) {

    if (typeof document === "undefined" || !document.querySelector) {
        return "";
    }

    const el = document.querySelector(`meta[name="${name}"]`);

    return el && el.getAttribute ? (el.getAttribute("content") || "").trim() : "";
}

// 口令哈希用的 salt（upstream 里叫 APP_KEY）。换掉之后，用旧 salt 建的笔记在这台实例上
// 就找不回来了（存储 key = md5(前 16 字节)，会跟着变）——想换先备份。
export const APP_KEY = injected("site-salt") || "notepad.mx";

// 页头左上角显示的名字；默认保持上游的 notepad.mx
export const SITE_NAME = injected("site-name") || "notepad.mx";

// The header banner text moved to src/i18n.js (key: "app.banner") so it can be
// translated along with the rest of the UI.

// 单篇笔记的上限，单位是「加密后发到服务端的请求体字节数」。
//
// 笔记保存时是 AES-256-CBC 密文按 hex 上送的：明文 UTF-8 字节数补齐到 16 的倍数后
// 再乘 2，外加一层小 JSON。所以这个值大约是「能存的明文」的两倍。
//
// 上限本身由容器环境变量 NOTE_MAX_BYTES 决定（认 480kb / 2m / 1048576 这些写法，
// 不配就用硬上限 32m），后端在启动时把它注入成 <meta name="note-max-bytes">，这里读的
// 就是那个值 —— 和 express 解析请求体的上限是同一个数，不会前后端各说一套。
// 读不到时（预渲染阶段、纯静态打开）退回同一个 32m。
const DEFAULT_NOTE_MAX_BYTES = 32 * 1024 * 1024;

function noteMaxBytesFromMeta() {

    const raw = injected("note-max-bytes");

    const value = parseInt(raw, 10);

    return isFinite(value) && value > 0 ? value : DEFAULT_NOTE_MAX_BYTES;
}

export const NOTE_MAX_BYTES = noteMaxBytesFromMeta();
