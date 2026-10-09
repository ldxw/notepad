import fs from "fs";
import path from "path";

/**
 * 运行时的页面元信息（<title> / description / keywords / author）。
 *
 * 构建出来的 index.html 里已经有默认值（来自 frontend/site.config.js，构建时注入）；
 * 这里在**容器启动时**用环境变量覆盖它们 —— 同一个镜像可以按部署环境重新定制：
 *
 *   docker run -e SITE_TITLE="我的记事本" \
 *              -e SITE_DESCRIPTION="安全地把笔记保存在网上" \
 *              -e SITE_KEYWORDS="记事本,加密笔记" \
 *              -e SITE_AUTHOR="ldxw" \
 *              -e SITE_LANG="zh" ...
 *
 * SITE_LANG 设的是**默认**界面语言（auto=跟随浏览器），前端 i18n 会读注入的
 * <meta name="default-locale">；访客自己在页面上选过的语言（localStorage）优先。
 *
 * 也可以写进 .env / docker-compose 的 environment 里。变量留空或未设置时，
 * 保持构建时的默认值不变。
 */
export class SiteMeta {

    /** 环境变量名 ← 对应 index.html 里的哪一项 */
    public static readonly ENV = {
        title: "SITE_TITLE",
        description: "SITE_DESCRIPTION",
        keywords: "SITE_KEYWORDS",
        author: "SITE_AUTHOR",
        lang: "SITE_LANG"
    };

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

        const description = env[SiteMeta.ENV.description];
        const keywords = env[SiteMeta.ENV.keywords];
        const author = env[SiteMeta.ENV.author];
        const title = env[SiteMeta.ENV.title];
        const lang = SiteMeta.normalizeLang(env[SiteMeta.ENV.lang]);

        if (lang) {

            // <html lang> 与实际默认语言保持一致
            html = html.replace(/(<html\b[^>]*\slang=")([^"]*)(")/i,
                (_match: string, open: string, _old: string, close: string) => {
                    return open + (lang === "zh" ? "zh-CN" : lang) + close;
                });

            // 前端 i18n 靠这个 meta 决定默认语言（localStorage 里的用户选择优先）
            html = SiteMeta.setMeta(html, "default-locale", lang);
        }

        if (description) {
            html = SiteMeta.replaceMeta(html, "description", description);
        }

        if (keywords) {
            html = SiteMeta.replaceMeta(html, "keywords", keywords);
        }

        if (author) {
            html = SiteMeta.replaceMeta(html, "author", author);
        }

        if (title) {
            html = html.replace(/(<title>)([\s\S]*?)(<\/title>)/i,
                (_m: string, open: string, _old: string, close: string) => {
                    return open + SiteMeta.escapeText(title) + close;
                });
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

    /** 启动日志用：本次生效的覆盖项（不含默认值） */
    public static describeOverrides(env: NodeJS.ProcessEnv = process.env): string[] {

        const applied: string[] = [];

        Object.keys(SiteMeta.ENV).forEach((key: string) => {
            const name = (SiteMeta.ENV as any)[key];
            if (env[name]) {
                applied.push(name + "=" + env[name]);
            }
        });

        return applied;
    }
}
