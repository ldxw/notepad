import {ref} from "vue";

import {injectedMeta} from "./i18n";

// 主题：跟随系统 / 浅色 / 深色。
// 用户选过的存在 localStorage；没选过就用容器启动时注入的 SITE_THEME
// （<meta name="site-theme">，默认 auto = 跟随系统）。
const STORAGE_KEY = "theme";

export const themes = [
    {code: "auto", labelKey: "theme.auto"},
    {code: "light", labelKey: "theme.light"},
    {code: "dark", labelKey: "theme.dark"}
];

// 切换器用的小图标：内联 SVG，不依赖 emoji 字体，任何环境渲染一致
const THEME_ICONS = {
    auto: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
    dark: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>'
};

export function themeIcon(code) {
    return THEME_ICONS[code] || THEME_ICONS.auto;
}

function isKnown(code) {
    return themes.some((t) => t.code === code);
}

function detectTheme() {

    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved && isKnown(saved)) {
            return saved;
        }
    } catch (ex) {
        // localStorage unavailable (private mode, prerender, ...)
    }

    const injected = (injectedMeta("site-theme") || "").toLowerCase();

    if (isKnown(injected)) {
        return injected;
    }

    return "auto";
}

// reactive current theme
export const theme = ref(detectTheme());

/** 当前实际是不是深色（auto 时看系统偏好） */
export function isDark() {

    if (theme.value === "dark") {
        return true;
    }

    if (theme.value !== "auto") {
        return false;
    }

    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function setTheme(code) {

    if (!isKnown(code)) {
        return;
    }

    theme.value = code;

    try {
        localStorage.setItem(STORAGE_KEY, code);
    } catch (ex) {
        // ignore
    }

    applyTheme();
}

/**
 * 把主题写到 <html data-theme>，CSS 变量据此切换；
 * auto 的情况交给样式表里的 prefers-color-scheme 媒体查询。
 */
export function applyTheme() {

    if (typeof document === "undefined") {
        return;
    }

    document.documentElement.dataset.theme = theme.value;

    // 告诉浏览器当前配色，滚动条与原生表单控件也会跟着变
    const meta = document.querySelector('meta[name="color-scheme"]');

    if (meta) {
        meta.setAttribute("content", isDark() ? "dark light" : "light dark");
    }
}
