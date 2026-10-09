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
