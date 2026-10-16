import fs from "fs";
import path from "path";

/**
 * 运行时的页面元信息（<title> / description / keywords / author / 站点名 / 图标 / 默认语言 / 口令 salt）。
 *
 * 构建出来的 index.html 里已经有默认值（来自 frontend/site.config.js，构建时注入）；
 * 这里在**容器启动时**用环境变量覆盖它们 —— 同一个镜像可以按部署环境重新定制：
 *
 *   docker run -e SITE_NAME_ZH="我的记事本" \
 *              -e SITE_NAME_EN="My Notepad" \
 *              -e SITE_TITLE_ZH="在线记事本 - 安全地把笔记保存在网上" \
 *              -e SITE_TITLE_EN="Online Notepad - store your notes securely online" ...
 *
 * 语言相关的那几项（title / description / keywords / siteName）都支持 `_ZH` / `_EN` 后缀：
 *   · 静态 HTML（爬虫看到的那份）用 SITE_LANG 指定语言的一套；SITE_LANG 没设就用英文那套
 *   · 不带后缀的 SITE_TITLE 之类仍然有效，作为所有语言通用的兜底值
 *   · 两套值都会作为 <meta name="site-title-zh"> / 「-en」注入，前端在切换界面语言时
 *     会据此同步更新 <title>、description / keywords meta 和页头左上角的名字
 *
 * 也可以写进 .env / docker-compose 的 environment 里。变量留空或未设置时保持原值。
 */
export class SiteMeta {

    /** 环境变量名（基础名） */
    public static readonly ENV = {
        title: "SITE_TITLE",
        description: "SITE_DESCRIPTION",
        keywords: "SITE_KEYWORDS",
        author: "SITE_AUTHOR",
        lang: "SITE_LANG",
        salt: "SITE_SALT",
        siteName: "SITE_NAME",
        icon: "SITE_ICON",
        theme: "SITE_THEME",
        skin: "SITE_SKIN"
    };

    /**
     * 首帧引导脚本：在 <head> 里、任何样式与打包脚本之前把主题属性定好。
     *
     * 静态 HTML 是构建时渲染的，带着构建机的默认主题；访客自己的选择存在 localStorage 里。
     * 不在最前面读出来，刷新时就会先闪一下默认主题再切过去。
     *
     * 这里只设属性（data-theme / data-skin），具体调色板令牌由前端的主题模块在挂载前写入
     * —— 调色板只有前端一份数据，不在这里重复一份。
     */
    protected static readonly THEME_BOOT_SCRIPT = '<script>(function(){try{'
        + 'var d=document.documentElement,h=document.head;'
        + 'var m="",s="";'
        + 'try{m=localStorage.getItem("theme")||"";s=localStorage.getItem("skin")||"";}catch(e){}'
        + 'if(!m){var a=h.querySelector(\'meta[name="site-theme"]\');m=a?(a.getAttribute("content")||""):"";}'
        + 'if(!s){var b=h.querySelector(\'meta[name="site-skin"]\');s=b?(b.getAttribute("content")||""):"";}'
        + 'd.setAttribute("data-theme",m||"auto");'
        + 'if(s){d.setAttribute("data-skin",s);}'
        + '}catch(e){}})();</script>';

    /** 支持 _ZH / _EN 后缀的项：环境变量基础名 → 注入给前端的 meta 名前缀 */
    public static readonly I18N_ITEMS: {[key: string]: {env: string, meta: string}} = {
        siteName: {env: "SITE_NAME", meta: "site-name"},
        title: {env: "SITE_TITLE", meta: "site-title"},
        description: {env: "SITE_DESCRIPTION", meta: "site-description"},
        keywords: {env: "SITE_KEYWORDS", meta: "site-keywords"}
    };

    /** 目前支持的语言 */
    public static readonly LANGS = ["en", "zh"];

    /** SITE_TITLE + "zh" → "SITE_TITLE_ZH" */
    protected static envNameFor(base: string, lang: string): string {
        return base + "_" + lang.toUpperCase();
    }

    /**
     * SITE_LANG 未设置时的语言推断：看语言相关变量里实际设了哪一套。
     * 设了任何 `_ZH` → zh；否则设了任何 `_EN` → en；都没设 → null（保持原行为）。
     * 目的是让「已经设了 SITE_NAME_ZH 之类」的部署不必再单独补一行 SITE_LANG。
     */
    public static inferLang(env: NodeJS.ProcessEnv = process.env): string | null {

        const bases = Object.keys(SiteMeta.I18N_ITEMS).map((key: string) => SiteMeta.I18N_ITEMS[key].env);

        const hasSuffix = (suffix: string) => bases.some((base: string) => !!env[base + suffix]);

        if (hasSuffix("_ZH")) {
            return "zh";
        }

        if (hasSuffix("_EN")) {
            return "en";
        }

        return null;
    }

    /** 标题没单独设时的兜底：退回同语言的站点名（再退到通用站点名），免得标题还是构建时的默认值 */
    protected static titleFallback(env: NodeJS.ProcessEnv, lang: string): string | undefined {
        return env[SiteMeta.envNameFor(SiteMeta.ENV.siteName, lang)]
            || env[SiteMeta.ENV.siteName]
            || undefined;
    }

    /** 取某项在 lang 下的值：优先 SITE_X_ZH / SITE_X_EN，其次通用 SITE_X，都没有则 undefined */
    public static valueFor(env: NodeJS.ProcessEnv, base: string, lang: string): string | undefined {
        return env[SiteMeta.envNameFor(base, lang)] || env[base] || undefined;
    }

    /**
     * SITE_LANG 归一化：未设置 / auto（默认）→ null，交给浏览器语言判断；
     * zh、zh-CN、zh_TW… → "zh"；en、en-US… → "en"；其它 → null 并打一条警告。
     */
    public static normalizeLang(value?: string): string | null {

        if (!value) {
            return null;
        }

        const raw = value.trim().toLowerCase().replace(/_/g, "-");

        if (!raw || raw === "auto" || raw === "browser" || raw === "detect") {
            return null;
        }

        if (raw === "zh" || raw.indexOf("zh-") === 0) {
            return "zh";
        }

        if (raw === "en" || raw.indexOf("en-") === 0) {
            return "en";
        }

        console.warn(`[meta] SITE_LANG="${value}" 暂不支持（目前只有 zh / en），已忽略，改用浏览器语言`);
        return null;
    }

    /** 设置（已存在则改写、不存在则插入）一个 <meta name=...>，保证脚本执行前就能读到 */
    protected static setMeta(html: string, name: string, value: string): string {

        const pattern = new RegExp('(<meta\\s+name="' + name + '"\\s+content=")([^"]*)(")', "i");

        if (pattern.test(html)) {
            return html.replace(pattern, (_match: string, open: string, _old: string, close: string) => {
                return open + SiteMeta.escapeAttr(value) + close;
            });
        }

        const tag = '<meta name="' + name + '" content="' + SiteMeta.escapeAttr(value) + '">';

        if (/<head[^>]*>/i.test(html)) {
            return html.replace(/(<head[^>]*>)/i, (_match: string, open: string) => open + "\n    " + tag);
        }

        return html.replace(/(<\/head>)/i, "  " + tag + "\n$1");
    }

    /** 替换（没有则插入）favicon：<link rel="icon" href="..."> */
    protected static setIcon(html: string, href: string): string {

        const pattern = /(<link\s+[^>]*rel="(?:shortcut )?icon"[^>]*href=")([^"]*)(")/i;

        if (pattern.test(html)) {
            return html.replace(pattern, (_match: string, open: string, _old: string, close: string) => {
                return open + SiteMeta.escapeAttr(href) + close;
            });
        }

        const tag = '<link rel="icon" href="' + SiteMeta.escapeAttr(href) + '">';

        if (/<head[^>]*>/i.test(html)) {
            return html.replace(/(<head[^>]*>)/i, (_match: string, open: string) => open + "\n    " + tag);
        }

        return html.replace(/(<\/head>)/i, "  " + tag + "\n$1");
    }

    /** 转义为双引号属性值安全的内容 */
    protected static escapeAttr(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    /** 转义为元素文本（<title>）安全的内容 */
    protected static escapeText(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    protected static replaceMeta(html: string, name: string, value: string): string {

        // <meta name="xxx" content="..."> —— 属性顺序/引号保持原样，只换内容
        const pattern = new RegExp('(<meta\\s+name="' + name + '"\\s+content=")([^"]*)(")', "i");

        if (!pattern.test(html)) {
            return html;
        }

        return html.replace(pattern, (_match: string, open: string, _old: string, close: string) => {
            return open + SiteMeta.escapeAttr(value) + close;
        });
    }

    /**
     * 把 SITE_* 环境变量应用到 HTML 上。未设置的变量不动 —— 保留构建时的默认值。
     * forcedLang：预渲染出多语言副本（index.zh.html / index.en.html）时，由调用方指明
     * 这份文件是哪一套语言，它优先于 SITE_LANG 的判断。
     */
    public static apply(html: string, env: NodeJS.ProcessEnv = process.env, forcedLang?: string): string {

        // SITE_LANG 的三种取值（与 .env.example 里的说明一致）：
        //   zh / en                    → 就用这一套
        //   auto（或 browser / detect）→ 跟随访客浏览器，静态 HTML 先取英文
        //   不设置                     → 按已设置的语言变量推断（设了 SITE_NAME_ZH 之类就当中文）
        const rawLang = String(env[SiteMeta.ENV.lang] === undefined ? "" : env[SiteMeta.ENV.lang]).trim();

        const configured = SiteMeta.normalizeLang(rawLang);

        const explicitAuto = /^(auto|browser|detect)$/i.test(rawLang);

        // 静态 HTML 里生效的是哪一套语言值，最后才退回英文；
        // forcedLang（多语言预渲染副本）优先
        const staticLang = forcedLang || configured || (explicitAuto ? null : SiteMeta.inferLang(env)) || "en";

        // <html lang> 跟静态 HTML 实际用的那套语言保持一致（含推断出来的语言）
        html = html.replace(/(<html\b[^>]*\slang=")([^"]*)(")/i,
            (_match: string, open: string, _old: string, close: string) => {
                return open + (staticLang === "zh" ? "zh-CN" : staticLang) + close;
            });

        // 前端 i18n 靠这个 meta 决定默认语言（localStorage 里的用户选择优先）；
        // 显式设了 SITE_LANG 时以它为准（这种情况服务端也只会发那一套的页面），
        // 否则以这份文件自身的语言为准；都没设就保持"跟随浏览器"的自动行为
        const defaultLocale = configured || forcedLang;

        if (defaultLocale) {
            html = SiteMeta.setMeta(html, "default-locale", defaultLocale);
        }

        // ---------- 语言相关项：两套都注入给前端，静态 HTML 里放 staticLang 那一套 ----------
        Object.keys(SiteMeta.I18N_ITEMS).forEach((key: string) => {

            const item = SiteMeta.I18N_ITEMS[key];
            const base = env[item.env];

            SiteMeta.LANGS.forEach((one: string) => {

                // 标题没单独设时退回同语言的站点名，免得中文站点顶上还挂着构建时的默认标题
                const value = env[SiteMeta.envNameFor(item.env, one)] || base
                    || (item.meta === "site-title" ? SiteMeta.titleFallback(env, one) : undefined);

                if (value) {
                    html = SiteMeta.setMeta(html, item.meta + "-" + one, value);
                }
            });

            const staticValue = SiteMeta.valueFor(env, item.env, staticLang)
                || (item.meta === "site-title" ? SiteMeta.titleFallback(env, staticLang) : undefined);

            if (!staticValue) {
                return;
            }

            // 注入给前端用的 meta 名（site-description / site-keywords）与页面里真正的
            // meta 名（description / keywords）不一样，这里映射一下
            const staticName: {[key: string]: string} = {
                "site-name": "site-name",
                "site-description": "description",
                "site-keywords": "keywords"
            };

            if (item.meta === "site-title") {
                html = html.replace(/(<title>)([\s\S]*?)(<\/title>)/i,
                    (_m: string, open: string, _old: string, close: string) => {
                        return open + SiteMeta.escapeText(staticValue) + close;
                    });
            } else {
                html = SiteMeta.setMeta(html, staticName[item.meta] || item.meta, staticValue);
            }
        });

        // 页头站名：预渲染出来的 HTML 里写死的是构建时的默认名（比如 notepad.mx），
        // 前端要等 Vue 挂载后才按 meta 改成配置值 —— 刷新时就能看到"先默认名、后配置名"的闪烁。
        // 这里直接把静态 HTML 里那段文字换掉，消除闪烁（图标在 <a> 外面，不受影响）。
        const staticSiteName = SiteMeta.valueFor(env, SiteMeta.ENV.siteName, staticLang);

        if (staticSiteName) {
            html = html.replace(/(<a\b[^>]*\bclass="[^"]*\bbrand\b[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/i,
                (_m: string, open: string, _old: string, close: string) => {
                    return open + SiteMeta.escapeText(staticSiteName) + close;
                });
        }

        // ---------- 与语言无关的项 ----------
        const author = env[SiteMeta.ENV.author];

        if (author) {
            html = SiteMeta.replaceMeta(html, "author", author);
        }

        // 口令 salt（upstream 里的 APP_KEY）
        const salt = env[SiteMeta.ENV.salt];

        if (salt) {
            html = SiteMeta.setMeta(html, "site-salt", salt);
        }

        // favicon：只有设了 SITE_ICON 才替换，否则保留构建时注入的默认图标
        const icon = env[SiteMeta.ENV.icon];

        if (icon) {
            html = SiteMeta.setIcon(html, icon);
        }

        // ---------- 主题（与语言无关）----------
        // 后端只校验格式；皮肤名单在前端（theme.js），前端会用它做成员校验，
        // 写错名字就退回默认皮肤，而不是渲染出一个没样式的页面。
        const themeMode = String(env[SiteMeta.ENV.theme] || "").trim().toLowerCase();

        if (themeMode) {
            if (/^(auto|light|dark)$/.test(themeMode)) {
                html = SiteMeta.setMeta(html, "site-theme", themeMode);
            } else {
                console.warn(`[meta] SITE_THEME="${themeMode}" 不是 auto / light / dark，已忽略`);
            }
        }

        const themeSkin = String(env[SiteMeta.ENV.skin] || "").trim().toLowerCase();

        if (themeSkin) {
            if (/^[a-z0-9-]+$/.test(themeSkin)) {
                html = SiteMeta.setMeta(html, "site-skin", themeSkin);
            } else {
                console.warn(`[meta] SITE_SKIN="${themeSkin}" 格式不合法（只允许小写字母、数字和连字符），已忽略`);
            }
        }

        // 引导脚本放在 </head> 之前：此时上面的 site-theme / site-skin 已经注入，
        // 脚本能读到它们；而打包脚本和样式还没执行，所以首帧就是正确的主题。
        html = html.replace(/(<\/head>)/i, (_match: string, close: string) => {
            return "    " + SiteMeta.THEME_BOOT_SCRIPT + "\n" + close;
        });

        return html;
    }

    /**
     * 读出 index.html 并应用环境变量覆盖；文件不存在时返回 null。
     * 可以指定文件名（多语言副本 index.zh.html / index.en.html）以及该文件对应的语言。
     */
    public static loadIndexHtml(publicDir: string, env: NodeJS.ProcessEnv = process.env,
                                name = "index.html", forcedLang?: string): string | null {

        const file = path.join(publicDir, name);

        if (!fs.existsSync(file)) {
            return null;
        }

        return SiteMeta.apply(fs.readFileSync(file, "utf-8"), env, forcedLang);
    }

    /** 启动日志用：本次生效的覆盖项（不含默认值），含 _ZH / _EN 变体 */
    public static describeOverrides(env: NodeJS.ProcessEnv = process.env): string[] {

        const names: string[] = [];

        Object.keys(SiteMeta.ENV).forEach((key: string) => {

            const base = (SiteMeta.ENV as any)[key];

            names.push(base);
            SiteMeta.LANGS.forEach((one: string) => names.push(SiteMeta.envNameFor(base, one)));
        });

        return names.filter((name: string) => env[name]).map((name: string) => name + "=" + env[name]);
    }
}
