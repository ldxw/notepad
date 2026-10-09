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
 *              -e SITE_AUTHOR="ldxw" ...
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
        author: "SITE_AUTHOR"
    };

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
