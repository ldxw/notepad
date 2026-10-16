/**
 * 主题系统：两轴（mode × skin）+ 令牌（CSS 自定义属性）的单一数据源。
 *
 * 轴：
 *   mode  auto / light / dark     只决定明暗；auto = 跟随系统（<html data-theme="auto"> + 媒体查询）
 *   skin  classic / paper / …     整套配色，可选带字体/圆角
 *
 * 优先级（和语言那套一致）：localStorage → 容器注入的 <meta> → 默认值。
 * 访客手动选过的记在 localStorage 里，优先于部署方用 SITE_THEME / SITE_SKIN 注入的默认。
 *
 * 为什么配色放在 JS 而不是样式表里：加一套主题只要在这儿加一条记录，
 * 选择面板里的预览色块也是从同一份数据算出来的，不会出现"两处各写一份、改一处忘一处"。
 * 样式表里只保留一套 classic 作为无 JS / 预渲染兜底。
 */

// 会改布局的主题：各自一个模块（自己的 CSS + 可选的行为），在这里登记
import {onApply as bentoOnApply} from "./themes/bento";
import {onApply as glassOnApply} from "./themes/glass";

export const DEFAULT_MODE = "auto";
export const DEFAULT_SKIN = "classic";

const STORAGE_MODE = "theme";
const STORAGE_SKIN = "skin";

const META_MODE = "site-theme";
const META_SKIN = "site-skin";

/** 生成一套配色的全部令牌：只给关键色，其余按同一色系推出来，避免每套写十条 */
function palette({bg, surface, surface2, text, muted, border, accent, link, code, header, btnBg, btnText, ring, ...extra}) {
    return {
        "--bg": bg,
        "--surface": surface,
        "--surface-2": surface2,
        "--text": text,
        "--muted": muted,
        "--border": border,
        "--accent": accent,
        "--link": link,
        "--code-bg": code,
        "--header-bg": header,
        // 行动按钮与键盘焦点环：没单独给就跟着主色走
        "--btn-bg": btnBg || accent,
        "--btn-text": btnText || "#ffffff",
        "--ring": ring || accent,
        // 主题自用的额外令牌（如 Glass 的渐变三段色），原样透传
        ...extra
    };
}

/**
 * 八套主题。classic 就是本站现在的外观（白底 + 米黄页头 + 红强调），
 * 所以默认不改变现有观感；其余七套是整体换色的皮肤。
 * paper 带衬线字体 + 6px 圆角，mono 带等宽字体 + 4px 圆角 —— 让"主题"不只是换个色相。
 */
export const skins = [

    {
        id: "classic",
        labelKey: "skin.classic",
        light: palette({
            bg: "#f8fafb", surface: "#ffffff", surface2: "#f1f5f9", text: "#123b38",
            muted: "#5b7080", border: "#dbe6e8", accent: "#0d9488", link: "#0d9488",
            code: "#f1f5f9", header: "#ffffff",
            btnBg: "#ea580c", btnText: "#000000", ring: "#0d9488"
        }),
        dark: palette({
            bg: "#0b1416", surface: "#101b1e", surface2: "#16262a", text: "#e6f2f1",
            muted: "#8fa8ae", border: "#1e3135", accent: "#2dd4bf", link: "#2dd4bf",
            code: "#16262a", header: "#0e191c",
            btnBg: "#f97316", btnText: "#0b1416", ring: "#2dd4bf"
        })
    },

    {
        id: "paper",
        labelKey: "skin.paper",
        light: {
            ...palette({
                bg: "#f6f1e7", surface: "#fffdf8", surface2: "#efe7d8", text: "#3b352c",
                muted: "#6f6656", border: "#e2d7c3", accent: "#a2542a", link: "#8a4a24",
                code: "#efe7d8", header: "#efe2cb"
            }),
            "--font-body": "Georgia, 'Songti SC', 'Noto Serif CJK SC', serif",
            "--radius": "6px"
        },
        dark: {
            ...palette({
                bg: "#1a1713", surface: "#221e19", surface2: "#2b2620", text: "#ece5d9",
                muted: "#b3a894", border: "#38312a", accent: "#d98b5a", link: "#e0a273",
                code: "#2b2620", header: "#231f19"
            }),
            "--font-body": "Georgia, 'Songti SC', 'Noto Serif CJK SC', serif",
            "--radius": "6px"
        }
    },

    {
        id: "ocean",
        labelKey: "skin.ocean",
        light: palette({
            bg: "#f2f7fb", surface: "#ffffff", surface2: "#e8f0f7", text: "#16303f",
            muted: "#5b7383", border: "#cfe0ec", accent: "#0b74c4", link: "#0b6ab0",
            code: "#e8f0f7", header: "#e3eef8"
        }),
        dark: palette({
            bg: "#0b1319", surface: "#111c24", surface2: "#16232d", text: "#dceaf3",
            muted: "#8ba7b8", border: "#213844", accent: "#38a3e8", link: "#5cb8f2",
            code: "#16232d", header: "#0e1a22"
        })
    },

    {
        id: "forest",
        labelKey: "skin.forest",
        light: palette({
            bg: "#f2f7f1", surface: "#ffffff", surface2: "#e7f0e5", text: "#1b2f22",
            muted: "#5c7361", border: "#cfdfcb", accent: "#2e7d4f", link: "#2a6f47",
            code: "#e7f0e5", header: "#e4f0e1"
        }),
        dark: palette({
            bg: "#0c1410", surface: "#121d17", surface2: "#18251d", text: "#dcecdf",
            muted: "#8aa891", border: "#223a2b", accent: "#4fbd7c", link: "#6ed19a",
            code: "#18251d", header: "#0f1a14"
        })
    },

    {
        id: "grape",
        labelKey: "skin.grape",
        light: palette({
            bg: "#f7f5fb", surface: "#ffffff", surface2: "#efeaf8", text: "#2b2440",
            muted: "#6d6486", border: "#ddd6ee", accent: "#6b46c1", link: "#5b3aab",
            code: "#efeaf8", header: "#ebe4f8"
        }),
        dark: palette({
            bg: "#100d18", surface: "#181428", surface2: "#211b33", text: "#e6e1f2",
            muted: "#9d94b8", border: "#2c2444", accent: "#a78bfa", link: "#bda6ff",
            code: "#211b33", header: "#130f1d"
        })
    },

    {
        id: "sunset",
        labelKey: "skin.sunset",
        light: palette({
            bg: "#fdf5f0", surface: "#ffffff", surface2: "#f8e9df", text: "#3a2419",
            muted: "#7a6154", border: "#f0d8c6", accent: "#e0561f", link: "#c94a1a",
            code: "#f8e9df", header: "#fae3d5"
        }),
        dark: palette({
            bg: "#170f0a", surface: "#221610", surface2: "#2c1d15", text: "#f4e3d8",
            muted: "#b79d8e", border: "#3d2a1e", accent: "#ff8a4c", link: "#ffa270",
            code: "#2c1d15", header: "#1c130d"
        })
    },

    {
        id: "mono",
        labelKey: "skin.mono",
        light: {
            ...palette({
                bg: "#fafafa", surface: "#ffffff", surface2: "#f0f0f0", text: "#111111",
                muted: "#6b6b6b", border: "#dcdcdc", accent: "#111111", link: "#111111",
                code: "#f0f0f0", header: "#ededed"
            }),
            "--font-body": "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
            "--radius": "4px"
        },
        dark: {
            ...palette({
                bg: "#0a0a0a", surface: "#141414", surface2: "#1c1c1c", text: "#ededed",
                muted: "#9a9a9a", border: "#2a2a2a", accent: "#ffffff", link: "#ffffff",
                code: "#1c1c1c", header: "#101010"
            }),
            "--font-body": "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
            "--radius": "4px"
        }
    },

    {
        id: "neon",
        labelKey: "skin.neon",
        light: palette({
            bg: "#f4f6ff", surface: "#ffffff", surface2: "#e9eeff", text: "#0f1230",
            muted: "#5b638c", border: "#d4dcff", accent: "#7c3aed", link: "#6d28d9",
            code: "#e9eeff", header: "#e6ebff"
        }),
        dark: palette({
            bg: "#07070f", surface: "#0f0f1c", surface2: "#161628", text: "#e8e8ff",
            muted: "#9a9ac4", border: "#24244a", accent: "#00e5ff", link: "#5ce1ff",
            code: "#161628", header: "#0a0a14"
        })
    },

    {
        // 会改布局的一套：除了配色，还把首页排成磁贴网格、页头滚动压缩。
        // 结构样式在 themes/bento.css，行为在 themes/bento.js。
        id: "bento",
        labelKey: "skin.bento",
        light: palette({
            bg: "#f7f8fa", surface: "#ffffff", surface2: "#eef0f4", text: "#1e2430",
            muted: "#667085", border: "#e3e6ec", accent: "#4f46e5", link: "#4338ca",
            code: "#eef0f4", header: "#ffffff",
            btnBg: "#4f46e5", btnText: "#ffffff", ring: "#4f46e5"
        }),
        dark: palette({
            bg: "#0f1117", surface: "#161923", surface2: "#1d212c", text: "#e8eaf0",
            muted: "#98a0b3", border: "#272c38", accent: "#818cf8", link: "#a5b4fc",
            code: "#1d212c", header: "#12151d",
            btnBg: "#818cf8", btnText: "#0f1117", ring: "#818cf8"
        })
    },

    {
        // 玻璃拟态：深蓝对角渐变底 + 星点 + 半透明磨砂卡片。
        // 结构样式在 themes/glass.css（渐变三段色等自用令牌也在那里消费）。
        id: "glass",
        labelKey: "skin.glass",
        light: palette({
            bg: "#eef2fb", surface: "rgba(255, 255, 255, .55)", surface2: "rgba(255, 255, 255, .45)",
            text: "#0f172a", muted: "rgba(15, 23, 42, .62)", border: "rgba(15, 23, 42, .12)",
            accent: "#2563eb", link: "#1d4ed8", code: "rgba(255, 255, 255, .5)", header: "rgba(255, 255, 255, .55)",
            btnBg: "#2563eb", btnText: "#ffffff", ring: "#2563eb",
            "--glass-from": "#dbeafe", "--glass-via": "#c7d2fe", "--glass-to": "#bfdbfe",
            "--glass-surface": "rgba(255, 255, 255, .55)",
            "--glass-border": "rgba(15, 23, 42, .12)",
            "--glass-input": "rgba(255, 255, 255, .72)",
            "--glass-heading": "#0f172a",
            "--glass-placeholder": "rgba(15, 23, 42, .45)",
            "--glass-stars": "0"   /* 浅色底上星点看不见，直接关掉 */
        }),
        dark: palette({
            bg: "#0f172a", surface: "rgba(255, 255, 255, .08)", surface2: "rgba(255, 255, 255, .06)",
            text: "#ffffff", muted: "rgba(255, 255, 255, .62)", border: "rgba(255, 255, 255, .18)",
            accent: "#93c5fd", link: "#bfdbfe", code: "rgba(255, 255, 255, .10)", header: "rgba(255, 255, 255, .06)",
            btnBg: "#3b82f6", btnText: "#ffffff", ring: "#93c5fd",
            "--glass-from": "#0f172a", "--glass-via": "#1e3a8a", "--glass-to": "#4a6fa5",
            "--glass-surface": "rgba(255, 255, 255, .08)",
            "--glass-border": "rgba(255, 255, 255, .18)",
            "--glass-input": "rgba(255, 255, 255, .10)",
            "--glass-heading": "#ffffff",
            "--glass-placeholder": "rgba(255, 255, 255, .55)",
            "--glass-stars": "1"
        })
    }
];

/** 主题自带的行为：applyTheme() 每次都会调用当前主题的钩子 */
const THEME_HOOKS = {
    bento: bentoOnApply,
    glass: glassOnApply
};

const CLASSIC = skins[0];

/** 取某套皮肤在某模式下的完整令牌；未知皮肤、或该皮肤缺某一模式时，都用 classic 兜底 */
export function paletteFor(id, dark) {

    const found = skins.find((one) => one.id === id) || CLASSIC;

    const use = dark ? "dark" : "light";

    return Object.assign({}, CLASSIC[use], found[use] || found.light);
}

/** 选择面板里的预览色块，用同一份数据算，不手写颜色 */
export function swatchFor(id, dark) {

    const p = paletteFor(id, dark);

    return {
        "--sw-bg": p["--bg"],
        "--sw-surface": p["--surface"],
        "--sw-accent": p["--accent"],
        "--sw-text": p["--text"]
    };
}

/** 读注入的 meta（预渲染的静态 HTML 里由容器写进去） */
function injectedMeta(name) {

    try {
        const el = document.querySelector(`meta[name="${name}"]`);
        return el ? String(el.getAttribute("content") || "").trim().toLowerCase() : "";
    } catch (ex) {
        return "";
    }
}

/** 读 localStorage；隐私模式 / 预渲染里会抛异常，按"没存过"处理 */
function stored(key) {

    try {
        return String(window.localStorage.getItem(key) || "").trim().toLowerCase();
    } catch (ex) {
        return "";
    }
}

export const MODES = ["auto", "light", "dark"];

let mode = DEFAULT_MODE;
let skin = DEFAULT_SKIN;

/** 初始状态：localStorage 优先，其次容器注入的 meta，最后默认值 */
export function initTheme() {

    const savedMode = stored(STORAGE_MODE);
    const savedSkin = stored(STORAGE_SKIN);

    mode = MODES.indexOf(savedMode) >= 0 ? savedMode : (MODES.indexOf(injectedMeta(META_MODE)) >= 0 ? injectedMeta(META_MODE) : DEFAULT_MODE);

    // 皮肤是否有效由前端判断（后端只校验格式），写错名字就退回默认，而不是整页没样式
    const injectedSkin = injectedMeta(META_SKIN);
    const wantedSkin = savedSkin || injectedSkin;

    skin = skins.some((one) => one.id === wantedSkin) ? wantedSkin : DEFAULT_SKIN;

    applyTheme();
}

/** 当前是否深色（auto 时问系统） */
export function isDark() {

    if (mode === "light") {
        return false;
    }

    if (mode === "dark") {
        return true;
    }

    try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (ex) {
        return false;
    }
}

/**
 * 把当前状态写到 <html>：data-theme / data-skin 供 CSS 与验证脚本读取，
 * 令牌写成内联自定义属性（内联的优先级高于样式表，所以样式表只需留一套兜底）。
 * 注意 data-theme 保留字面量 "auto"，不解析成 light/dark —— 否则打开着的页面就不再跟随系统了。
 */
export function applyTheme() {

    const html = document.documentElement;

    html.dataset.theme = mode;
    html.dataset.skin = skin;

    const palette = paletteFor(skin, isDark());

    Object.keys(palette).forEach((prop) => html.style.setProperty(prop, palette[prop]));

    // 主题自带的行为：会改布局的主题在这里初始化；切走时清掉它留下的标记
    const hook = THEME_HOOKS[skin];

    if (hook) {
        hook();
    } else {
        html.removeAttribute("data-scrolled");
    }

    // 让原生滚动条 / 表单控件跟着走
    try {
        let el = document.querySelector('meta[name="color-scheme"]');

        if (!el) {
            el = document.createElement("meta");
            el.setAttribute("name", "color-scheme");
            document.head.appendChild(el);
        }

        el.setAttribute("content", isDark() ? "dark light" : "light dark");
    } catch (ex) {
        // 忽略
    }
}

export function currentTheme() {
    return {mode, skin};
}

export function setMode(next) {

    if (MODES.indexOf(next) < 0) {
        return;
    }

    mode = next;

    try {
        window.localStorage.setItem(STORAGE_MODE, next);
    } catch (ex) {
        // 存不下也不影响本次生效
    }

    applyTheme();
}

export function setSkin(next) {

    if (!skins.some((one) => one.id === next)) {
        return;
    }

    skin = next;

    try {
        window.localStorage.setItem(STORAGE_SKIN, next);
    } catch (ex) {
        // 同上
    }

    applyTheme();
}

/** auto 模式下要跟着系统切换 */
export function watchSystemTheme() {

    try {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => {
            if (mode === "auto") {
                applyTheme();
            }
        };

        if (mq.addEventListener) {
            mq.addEventListener("change", onChange);
        } else if (mq.addListener) {
            mq.addListener(onChange);
        }
    } catch (ex) {
        // 忽略
    }
}
