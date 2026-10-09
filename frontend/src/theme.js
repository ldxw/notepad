import {ref} from "vue";

import {injectedMeta} from "./i18n";

// ── 两套互相独立的选择 ─────────────────────────────────────────────────────
//  mode（模式）：auto 跟随系统 / light 浅色 / dark 深色   —— 只管明暗
//  skin（皮肤）：classic / paper / ocean ...            —— 管整套配色
// 两者组合生效：同一个皮肤，浅色和深色各有各的色板。
// 想加一个主题 = 往下面 skins 里加一段数据，别的什么都不用改。

const MODE_KEY = "theme";   // 沿用老键名，老访客已经选过的深浅色不会丢
const SKIN_KEY = "skin";

export const modes = [
    {code: "auto", labelKey: "theme.auto"},
    {code: "light", labelKey: "theme.light"},
    {code: "dark", labelKey: "theme.dark"}
];

// 色板里直接写 CSS 变量名，applyTheme() 原样套到 <html> 上。
// 只放颜色/字体/圆角，阴影留在样式表里按深浅色走。
export const skins = [
    {
        id: "classic",
        labelKey: "skin.classic",
        light: {
            "--bg": "#f7f6f3", "--surface": "#ffffff", "--surface-2": "#f1f2f4",
            "--text": "#22262e", "--muted": "#6d737d", "--border": "#dcdfe4",
            "--accent": "#f42f42", "--link": "#1657d6", "--code-bg": "#f1f2f4",
            "--header-bg": "#fff8dc"
        },
        dark: {
            "--bg": "#0f1115", "--surface": "#171a20", "--surface-2": "#1e222a",
            "--text": "#e7e9ee", "--muted": "#98a0ad", "--border": "#2a2f39",
            "--accent": "#ff6b7a", "--link": "#7aa2ff", "--code-bg": "#1b1f26",
            "--header-bg": "#171a20"
        }
    },
    {
        id: "paper",
        labelKey: "skin.paper",
        light: {
            "--bg": "#f6f1e7", "--surface": "#fffdf8", "--surface-2": "#efe7d9",
            "--text": "#3b352c", "--muted": "#7d7466", "--border": "#e2d7c3",
            "--accent": "#a2542a", "--link": "#8a5a2b", "--code-bg": "#f0e8db",
            "--header-bg": "#efe4d2",
            "--font-body": "Georgia, 'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
            "--radius": "6px"
        },
        dark: {
            "--bg": "#1a1713", "--surface": "#221e19", "--surface-2": "#2a251f",
            "--text": "#ece5d9", "--muted": "#a89c8b", "--border": "#38312a",
            "--accent": "#d98b5a", "--link": "#d8a978", "--code-bg": "#24201a",
            "--header-bg": "#221e19",
            "--font-body": "Georgia, 'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
            "--radius": "6px"
        }
    },
    {
        id: "ocean",
        labelKey: "skin.ocean",
        light: {
            "--bg": "#f2f7fb", "--surface": "#ffffff", "--surface-2": "#e8f0f7",
            "--text": "#16303f", "--muted": "#5f7c8d", "--border": "#cfe0ec",
            "--accent": "#0b74c4", "--link": "#0b6ab8", "--code-bg": "#eaf2f8",
            "--header-bg": "#dcecf8"
        },
        dark: {
            "--bg": "#0b1319", "--surface": "#111c24", "--surface-2": "#16242e",
            "--text": "#dceaf3", "--muted": "#8aa7b8", "--border": "#213844",
            "--accent": "#38a3e8", "--link": "#5cb6f0", "--code-bg": "#121e26",
            "--header-bg": "#111c24"
        }
    },
    {
        id: "forest",
        labelKey: "skin.forest",
        light: {
            "--bg": "#f2f7f1", "--surface": "#ffffff", "--surface-2": "#e7f0e5",
            "--text": "#1b2f22", "--muted": "#5d7a64", "--border": "#cfdfcb",
            "--accent": "#2e7d4f", "--link": "#24704a", "--code-bg": "#eaf3e8",
            "--header-bg": "#dcefd8"
        },
        dark: {
            "--bg": "#0c1410", "--surface": "#121d17", "--surface-2": "#17261e",
            "--text": "#dcecdf", "--muted": "#8aac93", "--border": "#223a2b",
            "--accent": "#4fbd7c", "--link": "#6ed39a", "--code-bg": "#131f18",
            "--header-bg": "#121d17"
        }
    },
    {
        id: "grape",
        labelKey: "skin.grape",
        light: {
            "--bg": "#f7f5fb", "--surface": "#ffffff", "--surface-2": "#eeeaf7",
            "--text": "#2b2440", "--muted": "#6f6789", "--border": "#ddd6ee",
            "--accent": "#6b46c1", "--link": "#5b3fb8", "--code-bg": "#f0ecf9",
            "--header-bg": "#e6ddf8"
        },
        dark: {
            "--bg": "#100d18", "--surface": "#181428", "--surface-2": "#201a34",
            "--text": "#e6e1f2", "--muted": "#9d95b8", "--border": "#2c2444",
            "--accent": "#a78bfa", "--link": "#b9a3ff", "--code-bg": "#171327",
            "--header-bg": "#181428"
        }
    },
    {
        id: "sunset",
        labelKey: "skin.sunset",
        light: {
            "--bg": "#fdf5f0", "--surface": "#ffffff", "--surface-2": "#fbeade",
            "--text": "#3a2419", "--muted": "#8a6553", "--border": "#f0d8c6",
            "--accent": "#e0561f", "--link": "#c34a17", "--code-bg": "#fbeade",
            "--header-bg": "#fce3d2"
        },
        dark: {
            "--bg": "#170f0a", "--surface": "#221610", "--surface-2": "#2b1d15",
            "--text": "#f4e3d8", "--muted": "#b39179", "--border": "#3d2a1e",
            "--accent": "#ff8a4c", "--link": "#ffab72", "--code-bg": "#221610",
            "--header-bg": "#221610"
        }
    },
    {
        id: "mono",
        labelKey: "skin.mono",
        light: {
            "--bg": "#fafafa", "--surface": "#ffffff", "--surface-2": "#f0f0f0",
            "--text": "#111111", "--muted": "#6b6b6b", "--border": "#dcdcdc",
            "--accent": "#111111", "--link": "#333333", "--code-bg": "#f2f2f2",
            "--header-bg": "#ededed",
            "--font-body": "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace",
            "--radius": "4px"
        },
        dark: {
            "--bg": "#0a0a0a", "--surface": "#141414", "--surface-2": "#1c1c1c",
            "--text": "#ededed", "--muted": "#a0a0a0", "--border": "#2a2a2a",
            "--accent": "#ffffff", "--link": "#d0d0d0", "--code-bg": "#171717",
            "--header-bg": "#141414",
            "--font-body": "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace",
            "--radius": "4px"
        }
    },
    {
        id: "neon",
        labelKey: "skin.neon",
        light: {
            "--bg": "#f4f6ff", "--surface": "#ffffff", "--surface-2": "#eaefff",
            "--text": "#0f1230", "--muted": "#5f668c", "--border": "#d4dcff",
            "--accent": "#7c3aed", "--link": "#2563eb", "--code-bg": "#eef2ff",
            "--header-bg": "#e0e7ff"
        },
        dark: {
            "--bg": "#07070f", "--surface": "#0f0f1c", "--surface-2": "#16162a",
            "--text": "#e8e8ff", "--muted": "#8b8cb8", "--border": "#24244a",
            "--accent": "#00e5ff", "--link": "#7c7cff", "--code-bg": "#12122a",
            "--header-bg": "#0f0f1c"
        }
    }
];

const CLASSIC = skins[0];

export const DEFAULT_SKIN = "classic";

function isKnownSkin(id) {
    return skins.some((s) => s.id === id);
}

/** 取某个皮肤在当前明暗下的色板；未知皮肤 → 回落到经典 */
export function paletteFor(id, dark) {

    const found = skins.find((s) => s.id === id) || CLASSIC;
    const use = dark ? "dark" : "light";

    // 皮肤没配这一档就借用经典的，避免出现「某个模式没颜色可用」
    return Object.assign({}, CLASSIC[use], found[use] || found.light);
}

/** 主题面板里的预览小色块：底色 / 卡片色 / 强调色 / 文字色 */
export function swatchFor(id, dark) {

    const p = paletteFor(id, dark);

    return {
        "--sw-bg": p["--bg"],
        "--sw-surface": p["--surface"],
        "--sw-accent": p["--accent"],
        "--sw-text": p["--text"]
    };
}

// 切换器用的小图标：内联 SVG，不依赖 emoji 字体，任何环境渲染一致
const THEME_ICONS = {
    auto: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
    dark: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>'
};

export function themeIcon(code) {
    return THEME_ICONS[code] || THEME_ICONS.auto;
}

/** 打开主题面板的按钮图标（调色板） */
export const PALETTE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-1.6a1.9 1.9 0 0 0-1.3 3.2c.4.4.6.9.6 1.4A1.4 1.4 0 0 1 14.3 21Z"/><circle cx="7.5" cy="12" r="1.2"/><circle cx="9.8" cy="8.2" r="1.2"/><circle cx="14.2" cy="8.2" r="1.2"/></svg>';

function detectMode() {

    try {
        const saved = localStorage.getItem(MODE_KEY);

        if (saved && modes.some((m) => m.code === saved)) {
            return saved;
        }
    } catch (ex) {
        // localStorage 不可用（隐私模式、预渲染…）
    }

    const injected = (injectedMeta("site-theme") || "").trim().toLowerCase();

    if (modes.some((m) => m.code === injected)) {
        return injected;
    }

    return "auto";
}

function detectSkin() {

    try {
        const saved = localStorage.getItem(SKIN_KEY);

        if (saved && isKnownSkin(saved)) {
            return saved;
        }
    } catch (ex) {
        // 同上
    }

    const injected = (injectedMeta("site-skin") || "").trim().toLowerCase();

    if (isKnownSkin(injected)) {
        return injected;
    }

    return DEFAULT_SKIN;
}

// 当前明暗模式 / 当前皮肤（响应式，模板里直接用）
export const mode = ref(detectMode());
export const skin = ref(detectSkin());

// 兼容旧引用
export const themes = modes;
export const theme = mode;

/** 当前实际是不是深色（auto 时看系统偏好） */
export function isDark() {

    if (mode.value === "dark") {
        return true;
    }

    if (mode.value !== "auto") {
        return false;
    }

    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function setMode(code) {

    if (!modes.some((m) => m.code === code)) {
        return;
    }

    mode.value = code;

    try {
        localStorage.setItem(MODE_KEY, code);
    } catch (ex) {
        // ignore
    }

    applyTheme();
}

export function setSkin(id) {

    if (!isKnownSkin(id)) {
        return;
    }

    skin.value = id;

    try {
        localStorage.setItem(SKIN_KEY, id);
    } catch (ex) {
        // ignore
    }

    applyTheme();
}

export const setTheme = setMode;

/**
 * 把当前皮肤+模式的色板写到 <html> 上（内联 CSS 变量，优先级高于样式表）。
 * 样式表里的 :root / [data-theme] 只作为「JS 还没跑」和禁用 JS 时的兜底。
 */
export function applyTheme() {

    if (typeof document === "undefined") {
        return;
    }

    const html = document.documentElement;

    html.dataset.theme = mode.value;
    html.dataset.skin = skin.value;

    const palette = paletteFor(skin.value, isDark());

    for (const name of Object.keys(palette)) {
        html.style.setProperty(name, palette[name]);
    }

    // 告诉浏览器当前配色，滚动条与原生表单控件也会跟着变
    const meta = document.querySelector('meta[name="color-scheme"]');

    if (meta) {
        meta.setAttribute("content", isDark() ? "dark light" : "light dark");
    }
}

// auto 档下系统换了深浅色，页面跟着换
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {

    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const onChange = () => {
        if (mode.value === "auto") {
            applyTheme();
        }
    };

    if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onChange);
    } else if (typeof mq.addListener === "function") {
        mq.addListener(onChange);   // 老浏览器
    }
}
