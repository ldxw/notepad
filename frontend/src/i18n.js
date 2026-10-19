import {ref} from "vue";

const STORAGE_KEY = "locale";

// All user-facing copy lives here. Keys are dotted strings. Values may contain
// simple HTML (they are rendered with v-html where the original markup had tags).
// Placeholders like {name} are filled in by t(key, {name: value}).
// To add another language: add a top-level key here and to availableLocales.
export const messages = {

    en: {

        "app.banner": `<h3 class="mb-0">Store your notes securely online</h3>`,
        "app.footerCredit": `Built on the open-source <a href="https://github.com/Athlon1600/notepad" target="_blank" rel="nofollow noopener noreferrer">Athlon1600/notepad</a>`,
        "backups.title": "Backups",
        "backups.count": "{n} archives · {size} total",
        "backups.allOnly": "Encrypted note archives of this instance",
        "backups.notice": "Downloads are disabled by the administrator — this page only lists the archives.",
        "backups.latest": "latest",
        "backups.download": "download",
        "backups.off": "downloads off",
        "backups.empty": "No archives yet.",
        "backups.emptyHint": "Archives are created automatically on a schedule; the list shows up here once the first one exists.",
        "backups.introOn": "Encrypted note archives of this instance — anyone can download them.",
        "backups.introOff": "Encrypted note archives of this instance — downloads are off, so this page only lists them.",
        "backups.keep": "Only the last {days} day(s) are kept; older archives are removed automatically.",
        "backups.keepAll": "Nothing is deleted automatically — every archive is kept.",
        "backups.hint": "They hold encrypted note blobs only, useless without the matching passphrase; unpack a downloaded archive to carry the notes over to another instance.",

        "lang.label": "Language",
        "lang.switch": "Switch language",

        "theme.label": "Theme",
        "theme.auto": "Follow system",
        "theme.light": "Light",
        "theme.dark": "Dark",
        "theme.pick": "Choose a theme",
        "skin.classic": "Classic",
        "skin.paper": "Paper",
        "skin.ocean": "Ocean",
        "skin.forest": "Forest",
        "skin.grape": "Grape",
        "skin.sunset": "Sunset",
        "skin.mono": "Mono",
        "skin.neon": "Neon",
        "skin.bento": "Bento",
        "skin.glass": "Glass",
        "skin.fluid": "Fluid",

        "home.loginTitle": "🔑 Login with a unique passphrase",
        "home.phrasePlaceholder": "e.g: correct horse battery staple",
        "home.phraseHint": "Can be as short as you want, but in order to make it harder for others to guess (or brute-force), make it at least 4 words.",
        "home.characters": "Characters",
        "home.words": "Words",
        "home.entropy": "Entropy",
        "home.bits": "bits",
        "home.description": `A simple web-based application for people to write and store notes
            securely online. Can be accessed from any device anywhere in the world.
            Built to be as a more portable, more secure alternative to <strong>Simplenote</strong> and <strong>Evernote</strong>.`,
        "home.featuresTitle": "Features",
        "home.feature1": `🔑 <strong>Uses passphrase as your universal login</strong>
            - no accounts to create, no emails to verify.
            Pick some hard to guess combination of words, and that is your one and only login.`,
        "home.feature2": `🔐 <strong>Fully encrypted</strong> - your notes are encrypted client-side before being sent and
            stored on the server.
            No one (not even the authorities) will be able to decrypt or view the contents of your notes,
            unless they can guess your passphrase.`,
        "home.feature3": `💻 <strong>Open source</strong> - see how this all works, and deploy your own version of this
            application on your own servers if you want.`,
        "home.feature4": `💾 <strong>Fully exportable</strong> - anyone can download all the notes ever created on this app
            (encrypted of course), and host their own copy of this application including all of its data no
            problem! Your notes do not have to disappear if the server gets shut down, as long
            as copies of it are still being mirrored elsewhere.`,
        "home.portable": `It works on any device/platform that has a web-browser.
            It's also very small (~100 kilobytes), and very fast so it works well on even the slowest internet
            connections.`,
        "home.securityTitle": "🔐 How secure is it?",
        "home.securityP1": `It depends entirely on your passphrase. If someone can guess it (or brute-force it), then they would gain
            access to your notes.`,
        "home.securityP2": `Apart from that, your notes are fully encrypted client-side (using portion of your passphrase as the
            encryption key) before being saved on the server's hard drive.

            To prove how safe they are, you can actually download all the notes stored on this server from here:`,
        "home.securityP3": `You will get a bunch of files with encrypted looking text inside
            that is of no use to you, unless you plan on hosting your own copy
            of this application.`,
        "home.securityP4": `Additionally, there are no usernames or emails for us to keep track off.
            We do not log IP addresses either. All we have is a bunch of text files
            whose contents are a mystery to anyone without corresponding encryption key.`,
        "home.forgotTitle": "What happens if I forget my passphrase?",
        "home.forgotP": `Then your notes are lost forever.
            It will continue existing somewhere on the server,
            but because it was encrypted,
            not even the server administrator will be able to find it or decrypt it.`,

        "editor.toolbar": "🔒 All text is automatically encrypted and saved as you type.",
        "editor.placeholder": "Nothing written here yet! Write something!",
        "editor.words": "Words",
        "editor.characters": "Characters",
        "editor.lines": "Lines",
        "editor.deleteForever": "Delete Forever",
        "editor.saveFailed": "Something went wrong during saving: ",
        "editor.confirmDelete": "Are you sure?? This action cannot be undone",
        "editor.deleteFailed": "Failed to delete"
    },

    zh: {

        "app.banner": `<h3 class="mb-0">安全地把你的笔记保存在网上</h3>`,
        "app.footerCredit": `基于开源的 <a href="https://github.com/Athlon1600/notepad" target="_blank" rel="nofollow noopener noreferrer">Athlon1600/notepad</a> 构建`,
        "backups.title": "备份文件",
        "backups.count": "共 {n} 个归档 · 合计 {size}",
        "backups.allOnly": "本实例的加密笔记归档",
        "backups.notice": "管理员已关闭归档下载，这里只列出文件清单。",
        "backups.latest": "最新",
        "backups.download": "下载",
        "backups.off": "已关闭下载",
        "backups.empty": "还没有备份文件。",
        "backups.emptyHint": "备份由站点自动定时生成，不需要手动操作 —— 生成后这里就会显示清单。",
        "backups.introOn": "这里是本实例的加密笔记归档，任何人都可以下载。",
        "backups.introOff": "这里是本实例的加密笔记归档，下载已关闭，仅列出清单。",
        "backups.keep": "归档只保留最近 {days} 天，更早的会自动删除。",
        "backups.keepAll": "归档不自动删除，全部保留。",
        "backups.hint": "里面是加密后的笔记密文，没有对应口令无法解密；下载后解压，可以在另一个实例上继续使用这些笔记。",

        "lang.label": "语言",
        "lang.switch": "切换语言",

        "theme.label": "主题",
        "theme.auto": "跟随系统",
        "theme.light": "浅色",
        "theme.dark": "深色",
        "theme.pick": "选择主题",
        "skin.classic": "经典",
        "skin.paper": "纸张",
        "skin.ocean": "海洋",
        "skin.forest": "森林",
        "skin.grape": "葡萄",
        "skin.sunset": "日落",
        "skin.mono": "黑白",
        "skin.neon": "霓虹",
        "skin.bento": "磁贴",
        "skin.glass": "玻璃",
        "skin.fluid": "自适应",

        "home.loginTitle": "🔑 用一句独一无二的口令登录",
        "home.phrasePlaceholder": "例如：正确的马 电池 订书钉",
        "home.phraseHint": "随便多短都可以，但为了让别人更难猜到（或被暴力破解），建议至少用 4 个词。",
        "home.characters": "字符",
        "home.words": "单词",
        "home.entropy": "熵",
        "home.bits": "比特",
        "home.description": `一个简单的网页应用，让人们可以安全地在网上撰写和保存笔记。在世界任何角落、任何设备上都能访问。
            它的定位是比 <strong>Simplenote</strong> 和 <strong>Evernote</strong> 更轻便、更安全的替代品。`,
        "home.featuresTitle": "功能特性",
        "home.feature1": `🔑 <strong>用一句口令作为你的通用登录</strong>
            —— 无需注册账号，无需验证邮箱。
            随便想一个别人难以猜到的词组，它就是你的唯一登录凭证。`,
        "home.feature2": `🔐 <strong>全程加密</strong> —— 你的笔记在发往服务器之前，就已经在客户端完成加密。
            除非对方能猜出你的口令，否则任何人（哪怕是官方）都无法解密或查看你笔记的内容。`,
        "home.feature3": `💻 <strong>开源</strong> —— 你可以看到它是如何运作的，也可以把这份应用部署到你自己的服务器上。`,
        "home.feature4": `💾 <strong>完全可导出</strong> —— 任何人都可以下载这个应用上创建过的所有笔记（当然是加密的），
            并连同全部数据一起自建一份，毫无问题！即使服务器关停，只要还有别处保存着副本，你的笔记就不会消失。`,
        "home.portable": `任何带浏览器的设备或平台都能使用。
            它体积很小（约 100 KB）、速度很快，即使在最慢的网络环境下也能流畅使用。`,
        "home.securityTitle": "🔐 它有多安全？",
        "home.securityP1": `这完全取决于你的口令。如果有人能猜到它（或暴力破解它），就能拿到你的笔记。`,
        "home.securityP2": `除此之外，你的笔记在保存到服务器硬盘之前，已在客户端完整加密（用你口令的一部分作为加密密钥）。

            为了证明它有多安全，你其实可以在这里下载本服务器上保存的所有笔记：`,
        "home.securityP3": `你会得到一堆内容看起来像乱码的文件，
            除非你打算自建一份这个应用，否则对你没有任何用处。`,
        "home.securityP4": `另外，我们不会记录用户名或邮箱，也不记录 IP 地址。
            我们手上只有一堆文本文件，没有对应的加密密钥，任何人都无法得知里面的内容。`,
        "home.forgotTitle": "如果我忘记了口令会怎样？",
        "home.forgotP": `那你的笔记就永远找不回来了。
            它可能还存在于服务器的某个角落，但因为已被加密，
            连服务器管理员都无法找到或解密它。`,

        "editor.toolbar": "🔒 你输入的每一个字都会自动加密并保存。",
        "editor.placeholder": "这里还什么都没写！写点什么吧！",
        "editor.words": "单词",
        "editor.characters": "字符",
        "editor.lines": "行数",
        "editor.deleteForever": "永久删除",
        "editor.saveFailed": "保存时出错了：",
        "editor.confirmDelete": "确定吗？此操作无法撤销",
        "editor.deleteFailed": "删除失败"
    }
};

export const availableLocales = [
    {code: "en", label: "English"},
    {code: "zh", label: "中文"}
];

/** 读取后端注入的 <meta name="..."> 的 content；拿不到返回空串 */
function injectedMeta(name) {

    if (typeof document === "undefined" || !document.querySelector) {
        return "";
    }

    const el = document.querySelector(`meta[name="${name}"]`);

    return el && el.getAttribute ? (el.getAttribute("content") || "").trim() : "";
}

// 标题：后端可以用 SITE_TITLE_ZH / SITE_TITLE_EN 覆盖（见 backend/src/SiteMeta.ts），
// 页面语言一变，applyDocumentLocale() 会把 <title> 换成对应的那一份。
const TITLES = {
    en: injectedMeta("site-title-en") || "Online Notepad - store your notes securely online",
    zh: injectedMeta("site-title-zh") || "在线记事本 - 安全地把笔记保存在网上"
};

/**
 * 页头左上角显示的名字：优先 SITE_NAME_<当前语言>，其次通用的 SITE_NAME，
 * 最后才是内置默认值。这样中英界面各显示各的，不会"英文页面顶着中文站名"。
 */
export function siteNameFor(code) {
    return injectedMeta("site-name-" + code) || injectedMeta("site-name") || "notepad.mx";
}

function detectLocale() {

    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved && messages[saved]) {
            return saved;
        }
    } catch (ex) {
        // localStorage unavailable (private mode, prerender, ...)
    }

    // 容器启动时注入的默认语言（SITE_LANG → <meta name="default-locale">）；
    // 上面 localStorage 里保存的用户选择优先于它。
    const injected = injectedDefaultLocale();

    if (injected) {
        return injected;
    }

    const lang = ((typeof navigator !== "undefined" && navigator.language) || "en").toLowerCase();

    // zh, zh-CN, zh-TW, zh-Hans, ... all map to the single Chinese pack for now
    return lang.startsWith("zh") ? "zh" : "en";
}

/** 读出后端注入的默认语言；没有或不是已知语言时返回 null */
function injectedDefaultLocale() {

    const code = injectedMeta("default-locale").toLowerCase();

    return messages[code] ? code : null;
}

// reactive current locale; templates that call t() re-render when it changes
export const locale = ref(detectLocale());

/**
 * Translate a key for the active locale, falling back to English, then to the key itself.
 *
 * @param {string} key
 * @param {Object} [params] values for {placeholders} in the message
 * @returns {string}
 */
export function t(key, params) {

    const table = messages[locale.value] || messages.en;

    let str = table[key];

    if (str === undefined) {
        str = messages.en[key];
    }

    if (str === undefined) {
        return key;
    }

    if (params) {
        str = str.replace(/\{(\w+)\}/g, (match, name) => {
            return params[name] !== undefined ? params[name] : match;
        });
    }

    return str;
}

export function setLocale(code) {

    if (!messages[code]) {
        return;
    }

    locale.value = code;

    try {
        localStorage.setItem(STORAGE_KEY, code);
    } catch (ex) {
        // ignore
    }

    applyDocumentLocale();
}

/**
 * Keep <html lang>, the document title and the language-dependent metas in sync with the
 * active locale. The values themselves may be overridden per language by the backend
 * (SITE_TITLE_ZH / SITE_DESCRIPTION_ZH / … — see backend/src/SiteMeta.ts).
 */
export function applyDocumentLocale() {

    if (typeof document === "undefined") {
        return;
    }

    const code = locale.value;

    document.documentElement.lang = code === "zh" ? "zh-CN" : code;
    document.title = TITLES[code] || TITLES.en;

    // description / keywords 也跟着语言走
    ["description", "keywords"].forEach((name) => {

        const value = injectedMeta("site-" + name + "-" + code);

        if (!value) {
            return;
        }

        const el = document.querySelector(`meta[name="${name}"]`);

        if (el) {
            el.setAttribute("content", value);
        }
    });
}
