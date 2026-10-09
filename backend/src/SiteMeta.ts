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
        icon: "SITE_ICON"
    };

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
     */
    public static apply(html: string, env: NodeJS.ProcessEnv = process.env): string {

        const configured = SiteMeta.normalizeLang(env[SiteMeta.ENV.lang]);

        // 静态 HTML 里生效的是哪一套语言值：SITE_LANG 指定语言优先，没设就英文
        const staticLang = configured || "en";

        if (configured) {

            // <html lang> 与实际默认语言保持一致
            html = html.replace(/(<html\b[^>]*\slang=")([^"]*)(")/i,
                (_match: string, open: string, _old: string, close: string) => {
                    return open + (configured === "zh" ? "zh-CN" : configured) + close;
                });

            // 前端 i18n 靠这个 meta 决定默认语言（localStorage 里的用户选择优先）
            html = SiteMeta.setMeta(html, "default-locale", configured);
        }

        // ---------- 语言相关项：两套都注入给前端，静态 HTML 里放 staticLang 那一套 ----------
        Object.keys(SiteMeta.I18N_ITEMS).forEach((key: string) => {

            const item = SiteMeta.I18N_ITEMS[key];
            const base = env[item.env];

            SiteMeta.LANGS.forEach((one: string) => {

                const value = env[SiteMeta.envNameFor(item.env, one)] || base;

                if (value) {
                    html = SiteMeta.setMeta(html, item.meta + "-" + one, value);
                }
            });

            const staticValue = SiteMeta.valueFor(env, item.env, staticLang);

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

        return html;
    }

    /** 读出 index.html 并应用环境变量覆盖；文件不存在时返回 null */
    public static loadIndexHtml(publicDir: string, env: NodeJS.ProcessEnv = process.env): string | null {

        const file = path.join(publicDir, "index.html");

        if (!fs.existsSync(file)) {
            return null;
        }

        return SiteMeta.apply(fs.readFileSync(file, "utf-8"), env);
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
