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

        this.app.use(express.static(parentPublic, {
            etag: true
        }));
    }

    /**
     * 列出 public/backups 里的归档文件（就是 archive.sh / 容器内定时任务产出的那些）。
     * 和上游 notepad.mx/backups/ 一样是公开的 —— 这就是「所有笔记都可导出」的那条路子。
     *
     * 页面是服务端渲染的纯 HTML + 内联 CSS（零依赖）：深/浅色随系统、卡片式、进场动效，
     * 文案按 Accept-Language 在中/英之间切换。
     */
    protected enableBackupsIndex(publicDir: string) {

        const fs = require('fs');
        const backupsDir = path.join(publicDir, 'backups');

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

            const accept = String(req.headers['accept-language'] || '');
            const zh = /(^|[,;\s])zh\b/i.test(accept) || accept.toLowerCase().indexOf('zh') === 0;

            const totalSize = files.reduce((sum: number, f: any) => sum + f.size, 0);

            // 用内联 SVG 而不是 emoji：不依赖系统 emoji 字体，任何环境都长一样
            const boxIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);flex:none" aria-hidden="true"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="2" y="3" width="20" height="5" rx="1.5"/><path d="M10 12h4"/></svg>`;

            const cards = files.map((f: any, i: number) => {

                const badge = i === 0
                    ? `<span class="badge">${zh ? "最新" : "latest"}</span>`
                    : "";

                return `<a class="card" href="/backups/${encodeURIComponent(f.name)}" download style="--i:${i}">
  ${boxIcon}
  <span class="meta">
    <span class="name">${Server.escapeHtml(f.name)}${badge}</span>
    <span class="sub">${Server.formatBytes(f.size)} · ${Server.formatTime(f.mtime)}</span>
  </span>
  <span class="dl">${zh ? "下载" : "download"} ↓</span>
</a>`;
            }).join("\n");

            const empty = `<div class="empty">
  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted)" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h3.4l2 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
  <p>${zh ? "还没有备份文件。" : "No archives yet."}</p>
  <p class="muted">${zh
      ? "容器内的定时任务（<code>ARCHIVE_CRON</code>，默认每天 03:30）会自动生成，也可以手动执行："
      : "The in-container cron job (<code>ARCHIVE_CRON</code>, 03:30 daily by default) creates them, or run it by hand:"}</p>
  <pre>docker exec -it notepad sh -c "sh backend/bin/archive.sh"</pre>
</div>`;

            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(`<!DOCTYPE html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${zh ? "备份文件" : "Backups"}</title>
<style>
  :root {
    --bg: #f6f7f9;
    --card: #ffffff;
    --text: #16181d;
    --muted: #6b7280;
    --border: #e6e8ec;
    --accent: #3b6ef6;
    --shadow: 0 1px 2px rgba(16, 18, 27, .04), 0 8px 24px rgba(16, 18, 27, .06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0e1014;
      --card: #171a21;
      --text: #e8eaf0;
      --muted: #9aa1ad;
      --border: #262b35;
      --accent: #7aa2ff;
      --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 10px 30px rgba(0, 0, 0, .35);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 3rem 1.25rem 4rem;
    background: var(--bg);
    color: var(--text);
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 44rem; margin: 0 auto; }
  header { animation: rise .45s cubic-bezier(.2,.7,.3,1) both; }
  .top { display: flex; align-items: baseline; gap: .75rem; flex-wrap: wrap; }
  h1 { font-size: 1.5rem; margin: 0; letter-spacing: -.02em; }
  .summary { color: var(--muted); font-size: .875rem; margin: .4rem 0 0; }
  .back { display: inline-block; margin-bottom: 1.25rem; color: var(--muted); text-decoration: none; font-size: .875rem; }
  .back:hover { color: var(--accent); }
  .list { display: grid; gap: .6rem; margin-top: 1.75rem; }
  .card {
    display: flex; align-items: center; gap: .9rem;
    padding: .9rem 1rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    text-decoration: none; color: inherit;
    box-shadow: var(--shadow);
    transition: transform .18s cubic-bezier(.2,.7,.3,1), border-color .18s, box-shadow .18s;
    animation: rise .5s cubic-bezier(.2,.7,.3,1) both;
    animation-delay: calc(var(--i, 0) * 45ms + 80ms);
  }
  .card:hover { transform: translateY(-2px); border-color: var(--accent); }
  .card:active { transform: translateY(0); }
  .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .icon { font-size: 1.35rem; line-height: 1; }
  .meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .name { font-weight: 600; word-break: break-all; display: flex; align-items: center; gap: .5rem; }
  .badge {
    font-size: .68rem; font-weight: 600; letter-spacing: .02em;
    color: var(--accent); border: 1px solid currentColor;
    padding: .05rem .4rem; border-radius: 999px; white-space: nowrap;
  }
  .sub { color: var(--muted); font-size: .82rem; margin-top: .1rem; }
  .dl {
    color: var(--accent); font-size: .85rem; font-weight: 600;
    white-space: nowrap; opacity: .85; transition: opacity .18s, transform .18s;
  }
  .card:hover .dl { opacity: 1; transform: translateX(2px); }
  .empty {
    margin-top: 2rem; padding: 2rem 1.25rem; text-align: center;
    background: var(--card); border: 1px dashed var(--border); border-radius: 14px;
    animation: rise .5s cubic-bezier(.2,.7,.3,1) both;
  }
  .empty-icon { font-size: 1.75rem; }
  .empty p { margin: .5rem 0 0; }
  .muted { color: var(--muted); font-size: .875rem; }
  pre {
    margin: 1rem auto 0; padding: .6rem .8rem; text-align: left;
    background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
    overflow-x: auto; font-size: .8rem;
  }
  code { font-size: .85em; background: var(--bg); padding: .1rem .3rem; border-radius: 5px; }
  footer { margin-top: 2.5rem; color: var(--muted); font-size: .78rem; line-height: 1.7; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/">← ${zh ? "回到记事本" : "Back to notepad"}</a>
  <header>
    <div class="top">
      <h1><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);vertical-align:-4px;margin-right:.35rem" aria-hidden="true"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="2" y="3" width="20" height="5" rx="1.5"/><path d="M10 12h4"/></svg>${zh ? "备份文件" : "Backups"}</h1>
    </div>
    <p class="summary">${files.length
        ? (zh
            ? `共 ${files.length} 个归档 · 合计 ${Server.formatBytes(totalSize)}`
            : `${files.length} archive${files.length > 1 ? "s" : ""} · ${Server.formatBytes(totalSize)} total`)
        : (zh ? "本实例的加密笔记归档" : "Encrypted note archives of this instance")}</p>
  </header>

  ${files.length ? `<div class="list">\n${cards}\n</div>` : empty}

  <footer>
    ${zh
      ? `这里是本实例 <code>backend/public/backups/</code> 里的归档，公开可下载。<br>
         文件里是加密后的笔记密文，没有对应口令无法解密；换 salt 或换机器时可以用它们把数据搬过去。<br>
         时间为容器本地时间${process.env.TZ ? `（TZ=${Server.escapeHtml(process.env.TZ)}）` : ""}。`
      : `Archives from <code>backend/public/backups/</code> of this instance, public by design.<br>
         They contain encrypted note blobs only — useless without the matching passphrase — and can be
         unpacked into <code>backend/storage</code> to move data to another host or salt.<br>
         Times are the container's local time${process.env.TZ ? ` (TZ=${Server.escapeHtml(process.env.TZ)})` : ""}.`}
  </footer>
</div>
</body>
</html>`);
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
