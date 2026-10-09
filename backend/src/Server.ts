import {Application, NextFunction, Request, Response, Router} from "express";
import path from "path";

import {SiteMeta} from "./SiteMeta";

const express = require('express');

export class Server {

    public static readonly PORT_DEFAULT: number = 3000;

    public app: Application;
    protected router: Router;

    constructor() {

        let app = express();
        app.set('json spaces', 2);

        app.set('etag', false);
        app.disable('x-powered-by');

        this.router = Router();
        this.app = app;

        this.enablePost();
        this.enableStatic();
    }

    protected getRouter() {
        return this.router;
    }

    protected enablePost() {

        // 10 kilobytes of text MAX!! - ~10K chars, 5-6 word pages
        this.app.use(express.urlencoded({
            extended: true,
            limit: "10kb"
        }));

        // Expects: Content-Type: "text/plain"
        this.app.use(express.text({
            limit: "10kb"
        }));
    }

    protected enableStatic() {

        const parentPublic = path.join(__dirname, '../public');

        // 运行时的页面元信息：容器启动时用 SITE_* 环境变量覆盖 index.html 里构建时的默认值。
        // 必须在 express.static 之前注册，否则会被静态中间件先接管。
        const indexHtml = SiteMeta.loadIndexHtml(parentPublic);

        if (indexHtml !== null) {

            const overrides = SiteMeta.describeOverrides();

            if (overrides.length) {
                console.log(`[meta] page metadata overridden by env: ${overrides.join(", ")}`);
            }

            this.app.get(['/', '/index.html'], (req: Request, res: Response) => {
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.send(indexHtml);
            });
        }

        // /backups/ 的目录列表（express.static 不生成目录索引）—— 必须在 static 之前注册
        this.enableBackupsIndex(parentPublic);

        const staticMiddleware = express.static(parentPublic, {
            etag: true
        });

        // BACKUPS_DOWNLOAD=off 时，/backups/ 下的文件一律不发（列表页本身除外）。
        // 这里在静态中间件外面包一层，而不是只拦 /backups/:file —— 多写斜杠 //、
        // URL 编码（%2F、%2e）、子目录、大写 /BACKUPS 这些写法也一并挡住，
        // 也就是「复制文件名拼地址直接下」这条路走不通。
        this.app.use((req: Request, res: Response, next: NextFunction) => {

            if (Server.backupsDownloadEnabled()) {
                return staticMiddleware(req, res, next);
            }

            let path = String(req.originalUrl || "").split("?")[0];

            try {
                path = decodeURIComponent(path);
            } catch (ex) {
                // 非法百分号编码：保持原样判断，同样会被当成不允许的路径
            }

            // 压掉重复斜杠、"/./"，并统一小写（Windows 风格的大小写绕过也算）
            path = path.replace(/\/{2,}/g, "/").replace(/\/\.\//g, "/").toLowerCase();

            // 只有列表页本身放行（它已由上面的路由渲染成清单）
            if (path === "/backups" || path === "/backups/") {
                return next();
            }

            if (path.indexOf("/backups") === 0) {

                const zh = Server.prefersChinese(req);

                const body = `
  <h1>403</h1>
  <p>${zh
      ? "本实例已关闭归档下载（<code>BACKUPS_DOWNLOAD=off</code>）。"
      : "Backup downloads are disabled on this instance (<code>BACKUPS_DOWNLOAD=off</code>)."}</p>
  <p class="muted">${zh
      ? `文件清单仍然可以在 <a href="/backups/">/backups/</a> 查看。`
      : `The listing is still available at <a href="/backups/">/backups/</a>.`}</p>
`;

                return res.status(403)
                    .set('Content-Type', 'text/html; charset=utf-8')
                    .send(Server.pageShell(zh, zh ? "已关闭下载" : "Downloads disabled", body));
            }

            return staticMiddleware(req, res, next);
        });
    }

    /**
     * 归档下载开关（运行时变量 BACKUPS_DOWNLOAD）：
     *   不设（默认）/ on / true / 1 / yes  → 允许下载，和上游 notepad.mx 一样公开可下载；
     *   off / false / 0 / no / disabled    → 关闭：列表页照旧列出文件名、大小、时间，
     *                                        但不给下载入口，直接拼 /backups/<文件名> 也会被拦掉。
     *
     * 环境变量在进程启动时读取一次，改完需要重启容器。
     */
    protected static backupsDownloadEnabled(): boolean {

        const raw = String(process.env.BACKUPS_DOWNLOAD === undefined ? "" : process.env.BACKUPS_DOWNLOAD)
            .trim()
            .toLowerCase();

        if (!raw) {
            return true;
        }

        return !["off", "false", "0", "no", "disable", "disabled"].includes(raw);
    }

    /** Accept-Language 里是否要中文文案 */
    protected static prefersChinese(req: Request): boolean {

        const accept = String(req.headers['accept-language'] || '');

        return /(^|[,;\s])zh\b/i.test(accept) || accept.toLowerCase().indexOf('zh') === 0;
    }

    /**
     * 页头里的站点名，和首页同一套规则：_ZH / _EN 两套值，退回不带后缀的，
     * 都没有就用默认值。返回值已做 HTML 转义。
     */
    protected static siteNameFor(zh: boolean): string {

        const keys = zh
            ? ["SITE_NAME_ZH", "SITE_NAME", "SITE_NAME_EN"]
            : ["SITE_NAME_EN", "SITE_NAME", "SITE_NAME_ZH"];

        for (const key of keys) {

            const value = (process.env[key] || "").trim();

            if (value) {
                return Server.escapeHtml(value);
            }
        }

        return "notepad.mx";
    }

    /**
     * 页面样式，刻意与首页保持一致：
     *   'Trebuchet MS' 字体、cornsilk 页头 + 深灰分隔线、#f42f42 品牌红（下划线、悬停去掉）、
     *   #0000EE 下划线链接（悬停变红）、#aab7b8 边框、#a3a1a1 次要文字、#2c3e50 正文。
     * 首页没有深色模式，这里同样不做。
     */
    protected static pageCss(): string {

        return `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0 0 3rem;
    background: #ffffff;
    color: #2c3e50;
    font-family: 'Trebuchet MS', sans-serif;
  }
  .site-header {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    background-color: cornsilk;
    border-bottom: 1px solid darkgrey;
  }
  .site-header h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
  }
  .site-header .brand {
    font-family: "Arial Rounded MT Bold", serif;
    color: #f42f42;
    text-decoration: underline;
  }
  .site-header .brand:hover {
    text-decoration: none;
  }
  .page-icon { margin-right: 0.25rem; }
  a, a:visited, a:active {
    color: #0000EE;
    text-decoration: underline;
  }
  a:hover { color: red; }
  .wrap { max-width: 44rem; margin: 0 auto; padding: 2rem 1rem 0; }
  h1 { font-size: 2rem; margin: 0 0 1rem; }
  p { margin: 0 0 1rem; }
  .muted { color: #a3a1a1; }
  .summary { color: #a3a1a1; font-size: 0.9rem; margin: 0; }
  .notice {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin: 1.25rem 0;
    padding: 0.75rem 1rem;
    background: cornsilk;
    border: 1px solid #aab7b8;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .notice svg { flex: none; margin-top: 0.1rem; color: #a3a1a1; }
  .list { display: grid; gap: 0.5rem; margin-top: 1.5rem; }
  .card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #ffffff;
    border: 1px solid #aab7b8;
    border-radius: 6px;
    text-decoration: none;
    color: inherit;
  }
  .card:hover { border-color: #f42f42; }
  .card:hover .dl { color: red; }
  .card.static:hover { border-color: #aab7b8; }
  .card:focus-visible { outline: 2px solid #0000EE; outline-offset: 2px; }
  .file-icon { color: #a3a1a1; flex: none; }
  .meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .name { font-weight: 700; word-break: break-all; }
  .sub { color: #a3a1a1; font-size: 0.85rem; }
  .dl {
    color: #0000EE;
    text-decoration: underline;
    white-space: nowrap;
    font-size: 0.9rem;
  }
  .dl.off { color: #a3a1a1; text-decoration: none; }
  .badge {
    margin-left: 0.5rem;
    font-size: 0.7rem;
    font-weight: 700;
    color: #f42f42;
    border: 1px solid currentColor;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    white-space: nowrap;
  }
  .empty {
    margin-top: 1.5rem;
    padding: 1.5rem 1rem;
    text-align: center;
    background: #ffffff;
    border: 1px dashed #aab7b8;
    border-radius: 6px;
  }
  .empty p { margin: 0.5rem 0 0; }
  pre {
    margin: 0.75rem auto 0;
    padding: 0.6rem 0.8rem;
    text-align: left;
    background: #f6f6f6;
    border: 1px solid #aab7b8;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.8rem;
    font-family: monospace, courier;
  }
  code {
    background: #f6f6f6;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-family: monospace, courier;
    font-size: 0.9em;
  }
  footer { margin-top: 2.5rem; color: #a3a1a1; font-size: 0.8rem; line-height: 1.7; }
  footer code { background: transparent; padding: 0; }
  @media (max-width: 768px) {
    .page-icon { display: none; }
  }
`;
    }

    /** 套上站点页头，拼出完整 HTML（/backups/ 列表页与 403 页共用） */
    protected static pageShell(zh: boolean, title: string, body: string): string {

        return `<!DOCTYPE html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${Server.escapeHtml(title)}</title>
<style>
${Server.pageCss()}</style>
</head>
<body>
<div class="site-header">
  <h1><span class="page-icon">📃</span><a class="brand" href="/">${Server.siteNameFor(zh)}</a></h1>
</div>
<div class="wrap">
${body}
</div>
</body>
</html>`;
    }

    /**
     * 列出 public/backups 里的归档文件（就是 archive.sh / 容器内定时任务产出的那些）。
     * 和上游 notepad.mx/backups/ 一样是公开的 —— 这就是「所有笔记都可导出」的那条路子；
     * 想关掉下载就把 BACKUPS_DOWNLOAD 设成 off。
     *
     * 服务端渲染的纯 HTML + 内联 CSS（零依赖），样式与首页一致，
     * 文案按 Accept-Language 在中/英之间切换。
     */
    protected enableBackupsIndex(publicDir: string) {

        const fs = require('fs');
        const backupsDir = path.join(publicDir, 'backups');

        const canDownload = Server.backupsDownloadEnabled();

        this.app.get(['/backups', '/backups/'], (req: Request, res: Response) => {

            let files: {name: string, size: number, mtime: Date}[] = [];

            try {
                files = fs.readdirSync(backupsDir)
                    .map((name: string) => ({name, full: path.join(backupsDir, name)}))
                    .filter((f: any) => fs.statSync(f.full).isFile())
                    .map((f: any) => ({name: f.name, size: fs.statSync(f.full).size, mtime: fs.statSync(f.full).mtime}))
                    .sort((a: any, b: any) => b.mtime.getTime() - a.mtime.getTime());
            } catch (ex) {
                // 还没产生过备份（首次归档之前）—— 当作空目录处理
            }

            const zh = Server.prefersChinese(req);

            const totalSize = files.reduce((sum: number, f: any) => sum + f.size, 0);

            // 内联 SVG 而不是 emoji：不依赖系统 emoji 字体，任何环境都长一样
            const boxIcon = `<svg class="file-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="2" y="3" width="20" height="5" rx="1.5"/><path d="M10 12h4"/></svg>`;

            const cards = files.map((f: any, i: number) => {

                const badge = i === 0
                    ? `<span class="badge">${zh ? "最新" : "latest"}</span>`
                    : "";

                const inner = `  ${boxIcon}
  <span class="meta">
    <span class="name">${Server.escapeHtml(f.name)}${badge}</span>
    <span class="sub">${Server.formatBytes(f.size)} · ${Server.formatTime(f.mtime)}</span>
  </span>`;

                if (!canDownload) {
                    return `<div class="card static">
${inner}
  <span class="dl off">${zh ? "已关闭下载" : "downloads off"}</span>
</div>`;
                }

                return `<a class="card" href="/backups/${encodeURIComponent(f.name)}" download>
${inner}
  <span class="dl">${zh ? "下载" : "download"} ↓</span>
</a>`;
            }).join("\n");

            const empty = `<div class="empty">
  <svg class="file-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h3.4l2 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
  <p>${zh ? "还没有备份文件。" : "No archives yet."}</p>
  <p class="muted">${zh
      ? "容器内的定时任务（<code>ARCHIVE_CRON</code>，默认每天 03:30）会自动生成，也可以手动执行："
      : "The in-container cron job (<code>ARCHIVE_CRON</code>, 03:30 daily by default) creates them, or run it by hand:"}</p>
  <pre>docker exec -it notepad sh -c "sh backend/bin/archive.sh"</pre>
</div>`;

            // 关闭下载时的提示条
            const notice = canDownload ? "" : `<div class="notice">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>
  <span>${zh
      ? "管理员已关闭归档下载（<code>BACKUPS_DOWNLOAD=off</code>），这里只列出文件清单。"
      : "Downloads are disabled by the administrator (<code>BACKUPS_DOWNLOAD=off</code>) — this page only lists the archives."}</span>
</div>`;

            const body = `
  <h1>${zh ? "备份文件" : "Backups"}</h1>
  <p class="summary">${files.length
      ? (zh
          ? `共 ${files.length} 个归档 · 合计 ${Server.formatBytes(totalSize)}`
          : `${files.length} archive${files.length > 1 ? "s" : ""} · ${Server.formatBytes(totalSize)} total`)
      : (zh ? "本实例的加密笔记归档" : "Encrypted note archives of this instance")}</p>

  ${notice}

  ${files.length ? `<div class="list">\n${cards}\n</div>` : empty}

  <footer>
    ${zh
      ? `这里是本实例 <code>backend/public/backups/</code> 里的归档，${canDownload
          ? "公开可下载"
          : "已由 <code>BACKUPS_DOWNLOAD</code> 关闭下载，仅列出清单"}。<br>
         文件里是加密后的笔记密文，没有对应口令无法解密；换 salt 或换机器时可以用它们把数据搬过去。<br>
         时间为容器本地时间${process.env.TZ ? `（TZ=${Server.escapeHtml(process.env.TZ)}）` : ""}。`
      : `Archives from <code>backend/public/backups/</code> of this instance, ${canDownload
          ? "public by design"
          : "listed only — downloads are off via <code>BACKUPS_DOWNLOAD</code>"}.<br>
         They contain encrypted note blobs only — useless without the matching passphrase — and can be
         unpacked into <code>backend/storage</code> to move data to another host or salt.<br>
         Times are the container's local time${process.env.TZ ? ` (TZ=${Server.escapeHtml(process.env.TZ)})` : ""}.`}
  </footer>
`;

            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(Server.pageShell(zh, zh ? "备份文件" : "Backups", body));
        });
    }

    /** 文件名/文本进 HTML 前的转义 */
    protected static escapeHtml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /** 人类可读的文件大小 */
    protected static formatBytes(bytes: number): string {

        const units = ["B", "KB", "MB", "GB"];
        let value = bytes;
        let unit = 0;

        while (value >= 1024 && unit < units.length - 1) {
            value = value / 1024;
            unit++;
        }

        return (unit === 0 ? value : value.toFixed(1)) + " " + units[unit];
    }

    /** 容器本地时间（YYYY-MM-DD HH:mm） */
    protected static formatTime(date: Date): string {

        const pad = (n: number) => (n < 10 ? "0" : "") + n;

        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
            + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    protected registerNotFoundHandler() {

        this.app.all('*', (req: Request, res: Response, next: any) => {

            res.status(404).json({
                status: '404',
                message: `Can't find ${req.originalUrl} on this server!`
            });
        });
    }

    protected registerErrorHandler() {

        this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {

            let msg = err.toString();

            if (msg.includes("PayloadTooLargeError") || msg.includes("entity too large")) {

                return res.status(413).json({
                    status: 413,
                    error: 'Note text limit reached'
                });
            }

            return res.status(500).json({
                status: 500,
                error: msg
            });

        });
    }

    public start(port: number) {

        this.app.use(this.router);

        this.registerNotFoundHandler();
        this.registerErrorHandler();

        this.app.listen(port, function () {
            console.log(`Node Express Server listening on port: ${port}!`)
        });
    }
}
