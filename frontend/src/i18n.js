import {ref} from "vue";

const STORAGE_KEY = "locale";

// All user-facing copy lives here. Keys are dotted strings. Values may contain
// simple HTML (they are rendered with v-html where the original markup had tags).
// Placeholders like {name} are filled in by t(key, {name: value}).
// To add another language: add a top-level key here and to availableLocales.
export const messages = {

    en: {

        "app.banner": `<h3 class="mb-0">Store your notes securely online</h3>`,
        "app.githubRepo": "GitHub Repo",

        "lang.label": "Language",
        "lang.switch": "Switch language",

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
        "home.feedbackTitle": "💡 Ideas/Feedback",
        "home.feedbackP": `This project is entirely open source. You can discuss it all on our GitHub page here:`,

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
        "app.githubRepo": "GitHub 仓库",

        "lang.label": "语言",
        "lang.switch": "切换语言",

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
        "home.feedbackTitle": "💡 想法 / 反馈",
        "home.feedbackP": `这个项目完全开源。欢迎到我们的 GitHub 页面一起讨论：`,

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

const TITLES = {
    en: "Online Notepad - store your notes securely online",
    zh: "在线记事本 - 安全地把笔记保存在网上"
};

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

    if (typeof document === "undefined" || !document.querySelector) {
        return null;
    }

    const meta = document.querySelector('meta[name="default-locale"]');
    const code = meta && meta.getAttribute ? (meta.getAttribute("content") || "").trim().toLowerCase() : "";

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

/** Keep <html lang> and the document title in sync with the active locale. */
export function applyDocumentLocale() {

    if (typeof document === "undefined") {
        return;
    }

    const code = locale.value;

    document.documentElement.lang = code === "zh" ? "zh-CN" : code;
    document.title = TITLES[code] || TITLES.en;
}
