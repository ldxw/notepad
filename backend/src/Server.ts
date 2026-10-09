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

        this.app.use(express.static(parentPublic, {
            etag: true
        }));
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
