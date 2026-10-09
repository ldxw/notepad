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
     */
    protected enableBackupsIndex(publicDir: string) {

        const fs = require('fs');
        const backupsDir = path.join(publicDir, 'backups');

        this.app.get(['/backups', '/backups/'], (req: Request, res: Response) => {

            let files: string[] = [];

            try {
                files = fs.readdirSync(backupsDir)
                    .filter((name: string) => fs.statSync(path.join(backupsDir, name)).isFile())
                    .sort((a: string, b: string) => fs.statSync(path.join(backupsDir, b)).mtimeMs - fs.statSync(path.join(backupsDir, a)).mtimeMs);
            } catch (ex) {
                // 还没产生过备份（首次归档之前）—— 当作空目录处理
            }

            const rows = files.map((name: string) => {

                const stat = fs.statSync(path.join(backupsDir, name));

                return '<tr>'
                    + '<td><a href="/backups/' + encodeURIComponent(name) + '">' + Server.escapeHtml(name) + '</a></td>'
                    + '<td>' + Server.formatBytes(stat.size) + '</td>'
                    + '<td>' + stat.mtime.toISOString().replace('T', ' ').slice(0, 19) + ' UTC</td>'
                    + '</tr>';
            }).join('\n');

            const empty = '<tr><td colspan="3" class="muted">还没有备份文件。'
                + '容器内的定时任务（ARCHIVE_CRON，默认每天 03:30）会自动生成，'
                + '也可以手动执行 <code>docker exec -it notepad sh -c "sh backend/bin/archive.sh"</code>。</td></tr>';

            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Backups</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 2.5rem auto; max-width: 46rem; padding: 0 1rem; color: #222; line-height: 1.5; }
  h1 { font-size: 1.25rem; margin-bottom: .25rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid #eee; font-size: .92rem; }
  th { color: #666; font-weight: 600; }
  .muted { color: #777; font-size: .85rem; }
  code { background: #f4f4f4; padding: .1rem .3rem; border-radius: 3px; font-size: .85em; }
  a { color: #0b5fff; }
</style>
</head>
<body>
<h1>📦 备份文件 / Backups</h1>
<p class="muted">这里是本实例 <code>backend/public/backups/</code> 里的归档文件，公开可下载。
文件里是加密后的笔记密文，没有对应口令无法解密；换 salt 或换实例时可以用它们把数据搬过去。</p>
<table>
<thead><tr><th>文件</th><th>大小</th><th>修改时间</th></tr></thead>
<tbody>
${rows || empty}
</tbody>
</table>
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
