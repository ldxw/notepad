import {Application, NextFunction, Request, Response, Router} from "express";
import fs from "fs";
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

        // 服务端渲染页（/backups/、403）也要跟随主题：把构建期导出的调色板算成样式，只算一次
        Server.themeCss = Server.buildThemeCss(parentPublic);

        // 预渲染时如果为每种语言各渲染了一份（index.zh.html / index.en.html），
        // 这里按访客的 Accept-Language 挑对应那份 —— 中英访客首屏就是自己的语言，不用等前端切。
        const indexByLang: {[key: string]: string} = {};

        ["zh", "en"].forEach((one: string) => {

            const html = SiteMeta.loadIndexHtml(parentPublic, process.env, "index." + one + ".html", one);

            if (html !== null) {
                indexByLang[one] = html;
            }
        });

        if (indexHtml !== null || Object.keys(indexByLang).length) {

            const overrides = SiteMeta.describeOverrides();

            if (overrides.length) {
                console.log(`[meta] page metadata overridden by env: ${overrides.join(", ")}`);
            }

            if (Object.keys(indexByLang).length) {
                console.log(`[meta] 按语言预渲染的页面: ${Object.keys(indexByLang).join(" / ")}`);
            }

            this.app.get(['/', '/index.html'], (req: Request, res: Response) => {

                // 运行时显式设了 SITE_LANG（zh / en）就用那一套、忽略访客语言；
                // 没设或写的是 auto 时，才按访客的 Accept-Language 挑预渲染的那份
                const pinned = SiteMeta.normalizeLang(process.env[SiteMeta.ENV.lang]);

                const lang = pinned || (Server.prefersChinese(req) ? "zh" : "en");

                const html = indexByLang[lang] || indexHtml;

                if (!html) {
                    res.status(404).send("Not Found");
                    return;
                }

                res.set('Content-Type', 'text/html; charset=utf-8');
                // 同一个地址会按语言发不同内容，告诉中间的缓存/代理别把语言串了
                res.set('Vary', 'Accept-Language');
                res.send(html);
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

                const zh = Server.resolveLangZh(req, res);

                const body = `
  <h1>403</h1>
  <p>${zh
      ? "本实例已关闭归档下载。"
      : "Backup downloads are disabled on this instance."}</p>
  <p class="muted">${zh
      ? `文件清单仍然可以在 <a href="/backups/">/backups/</a> 查看。`
      : `The listing is still available at <a href="/backups/">/backups/</a>.`}</p>
`;

                return res.status(403)
                    .set('Content-Type', 'text/html; charset=utf-8')
                    .send(Server.pageShell(zh, zh ? "已关闭下载" : "Downloads disabled", body,
                        String(req.originalUrl || "/").split("?")[0]));
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

    /** 语言选择记在这个 cookie 里（服务端渲染页用；首页仍然用它自己的 localStorage["locale"]） */
    protected static readonly LANG_COOKIE: string = "notepad_lang";
    protected static readonly LANG_COOKIE_MAX_AGE: number = 60 * 60 * 24 * 365;

    /** 归一化成 zh / en，认不出来返回 null */
    protected static normalizeLang(value: string): "zh" | "en" | null {

        const v = String(value || "").trim().toLowerCase();

        if (!v) {
            return null;
        }

        if (v.indexOf("zh") === 0) {
            return "zh";
        }

        if (v.indexOf("en") === 0) {
            return "en";
        }

        return null;
    }

    /** 读一个 cookie（express 没装 cookie-parser，这里自己拆） */
    protected static readCookie(req: Request, name: string): string {

        const raw = String(req.headers.cookie || "");

        for (const part of raw.split(";")) {

            const eq = part.indexOf("=");

            if (eq < 0) {
                continue;
            }

            if (part.substring(0, eq).trim() === name) {
                return decodeURIComponent(part.substring(eq + 1).trim());
            }
        }

        return "";
    }

    /**
     * 服务端渲染页（/backups/、403）用哪套语言，优先级和首页保持一致：
     *   ① ?lang=zh|en（显式切换，同时写下 cookie）
     *   ② 之前选过的 cookie
     *   ③ SITE_LANG（容器启动时注入的默认语言，和首页的 default-locale 同源）
     *   ④ 浏览器 Accept-Language
     * 传了 res 的话，第 ① 种会顺手 Set-Cookie，下次不带参数也记得。
     */
    protected static resolveLangZh(req: Request, res?: Response): boolean {

        const query = Server.normalizeLang(String((req.query || {})["lang"] || ""));

        if (query) {

            if (res) {
                res.setHeader("Set-Cookie", Server.LANG_COOKIE + "=" + query
                    + "; Path=/; Max-Age=" + Server.LANG_COOKIE_MAX_AGE + "; SameSite=Lax");
            }

            return query === "zh";
        }

        const saved = Server.normalizeLang(Server.readCookie(req, Server.LANG_COOKIE));

        if (saved) {
            return saved === "zh";
        }

        const siteDefault = Server.normalizeLang(process.env.SITE_LANG || "");

        if (siteDefault) {
            return siteDefault === "zh";
        }

        return Server.prefersChinese(req);
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

    /** 是不是归档文件名：archive.tar.gz 或 archive_YYYYMMDD.tar.gz（archive.sh 只产出这两种） */
    protected static isArchiveName(name: string): boolean {

        return /^archive(_\d{8})?\.tar\.gz$/i.test(name);
    }

    /**
     * 页脚一行：年份 + 站名 + 上游归属。
     * 上游链接保持原样（指向 GitHub 上的原始项目），这是页面上对上游的署名。
     */
    protected static footerText(zh: boolean): string {

        const year = new Date().getFullYear();

        const upstream = `<a href="https://github.com/Athlon1600/notepad" target="_blank" rel="nofollow noopener noreferrer">Athlon1600/notepad</a>`;

        return zh
            ? `© ${year} ${Server.siteNameFor(zh)} · 基于开源的 ${upstream} 构建`
            : `© ${year} ${Server.siteNameFor(zh)} · Built on the open-source ${upstream}`;
    }

    /**
     * 页头中间的标语 —— 与首页同一句话（首页取自 frontend/src/i18n.js 的 app.banner）。
     * 改文案时两边一起改：首页在 i18n.js，服务端渲染页在这里。
     */
    protected static headerBanner(zh: boolean): string {

        return zh ? "安全地把你的笔记保存在网上" : "Store your notes securely online";
    }

    /**
     * 归档保留天数（运行时变量 ARCHIVE_KEEP_DAYS），只用于在 /backups/ 页上说明策略；
     * 真正的删除在 backend/bin/archive.sh 里做。解析规则和它保持一致：
     * 不设 / 0 / off / false / no / disabled → null（保留全部）；正整数 → 该数字。
     */
    protected static archiveKeepDays(): number | null {

        const raw = String(process.env.ARCHIVE_KEEP_DAYS === undefined ? "" : process.env.ARCHIVE_KEEP_DAYS)
            .trim()
            .toLowerCase();

        if (!raw || ["0", "off", "false", "no", "disable", "disabled"].includes(raw)) {
            return null;
        }

        return /^[0-9]+$/.test(raw) ? parseInt(raw, 10) : null;
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
  #q { display: none; }
  .header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background-color: cornsilk;
    border-bottom: 1px solid darkgrey;
    position: sticky;
    top: 0;
    z-index: 40;
  }
  .header h1 {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    flex: none;
  }
  .header .brand { color: #2c3e50; text-decoration: none; }
  .header .brand:hover { color: #f42f42; text-decoration: none; }
  .brand-icon {
    display: inline-flex;
    width: 1.25rem;
    height: 1.25rem;
    color: #f42f42;
    flex: none;
  }
  .brand-icon svg { width: 100%; height: 100%; }
  .banner { flex: 1; text-align: center; min-width: 0; }
  .banner h3 { margin: 0; font-size: 0.95rem; font-weight: 500; color: #7d8f8b; }
  .header .right { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; flex: none; }
  .lang-switch, .seg {
    display: flex;
    align-items: center;
    border: 1px solid #aab7b8;
    border-radius: 8px;
    background: #ffffff;
    overflow: hidden;
  }
  .lang-btn, .seg-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.25rem;
    padding: 0 0.6rem;
    background: transparent;
    border: 0;
    color: #6b7a86;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition: background-color .16s ease, color .16s ease;
  }
  .lang-btn + .lang-btn, .seg + .seg { border-left: 1px solid #aab7b8; }
  .lang-btn:hover, .seg-btn:hover { background: #eef3f2; color: #2c3e50; text-decoration: none; }
  .lang-btn.active, .seg-btn.active {
    background: color-mix(in srgb, #0d9488 12%, transparent);
    color: #0d9488;
    font-weight: 700;
    cursor: default;
  }
  .seg-btn svg { width: 1rem; height: 1rem; }
  .seg select {
    min-height: 2.25rem;
    padding: 0 0.5rem;
    border: 0;
    background: transparent;
    color: #2c3e50;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .seg select:focus-visible { outline: 2px solid #0d9488; outline-offset: -2px; }
  @media (max-width: 767px) {
    .banner { display: none; }
    .header { padding: 0.5rem 0.75rem; gap: 0.35rem; }
    .header h1 { font-size: 1rem; }
  }
  @media (max-width: 640px) {
    .header .brand { display: none; }
    .lang-btn, .seg-btn { padding: 0 0.45rem; font-size: 0.8rem; }
    .seg select { padding: 0 0.3rem; font-size: 0.8rem; max-width: 5.5rem; }
  }
  @media (max-width: 360px) {
    .header { padding: 0.5rem; gap: 0.25rem; }
    .lang-btn, .seg-btn { min-height: 2rem; padding: 0 0.35rem; font-size: 0.75rem; }
    .seg select { padding: 0 0.2rem; font-size: 0.75rem; max-width: 4.6rem; }
  }
  a, a:visited, a:active {
    color: #0000EE;
    text-decoration: underline;
  }
  a:hover { color: red; }
  .wrap { max-width: 44rem; margin: 0 auto; padding: 2rem 1rem 0; }
  .wrap h1 { font-size: 2rem; margin: 0 0 0.5rem; text-align: center; }
  p { margin: 0 0 1rem; }
  .muted { color: #a3a1a1; }
  .summary { color: #a3a1a1; font-size: 0.9rem; margin: 0; text-align: center; }
  .notice {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
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
  /* 说明卡片：原来是裸露的一行行小字，改成居中的带框卡片 */
  .notes {
    max-width: 34rem;
    margin: 2.5rem auto 0;
    padding: 1.25rem 1.5rem;
    background: #fafafa;
    border: 1px solid #d8dede;
    border-radius: 10px;
    color: #6b6f76;
    font-size: 0.85rem;
    line-height: 1.8;
    text-align: center;
  }
  .notes p { margin: 0; }
  .notes p + p { margin-top: 0.6rem; }
  .notes .muted { color: #a3a1a1; }
  /* 站点页脚（与首页同款，居中在正文宽度内） */
  .site-footer {
    max-width: 44rem;
    margin: 3rem auto 0;
    padding: 1rem 1rem 0;
    border-top: 1px solid #aab7b8;
    color: #a3a1a1;
    font-size: 0.8rem;
    text-align: center;
  }
  .site-footer p { margin: 0; }
  .site-footer a { color: #a3a1a1; }
  .site-footer a:hover { color: #f42f42; }
  /* 页头中间标语（首页同款：居中，窄屏隐藏） */
  .site-header .banner {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0 1rem;
    text-align: center;
  }
  .site-header .banner h3 {
    margin: 0;
    font-size: 1.17rem;
    font-weight: 700;
  }
  .site-header .right {
    display: flex;
    align-items: center;
    flex: none;
    /* 窄屏时中间的标语会隐藏，这一组必须自己贴右，否则会紧跟在站名后面 */
    margin-left: auto;
  }
  .site-header .nav-links a { padding: 0 0.5rem; }
  .lang-switch {
    display: flex;
    align-items: center;
    flex: none;
    margin-left: 0.5rem;
    border: 1px solid #aab7b8;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.6);
    overflow: hidden;
  }
  .lang-switch .lang-btn {
    display: block;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    line-height: 1.2;
    color: #2c3e50;
    text-decoration: none;
    white-space: nowrap;
  }
  .lang-switch .lang-btn + .lang-btn { border-left: 1px solid #aab7b8; }
  .lang-switch a.lang-btn:hover { background-color: rgba(0, 0, 0, 0.06); color: #2c3e50; }
  .lang-switch .lang-btn.active {
    background-color: rgba(44, 62, 80, 0.16);
    font-weight: 700;
    cursor: default;
  }
  @media (max-width: 768px) {
    .page-icon { display: none; }
    /* 和首页一致：窄屏只留站名 + 语言切换 */
    .site-header .banner, .site-header .nav-links { display: none; }
  }
`;
    }

    /** 服务端渲染页用的主题样式（启用静态资源时算一次） */
    protected static themeCss = "";

    /** 可用皮肤 id（buildThemeCss 读到 themes.json 时填，供服务端页的主题下拉用） */
    protected static themeSkins: string[] = [];

    /**
     * 服务端渲染页的主题样式，启动时算一次（enableStatic 里调用）。
     *
     * 首页是 JS 把令牌写成 <html> 的内联变量；这两张页面没有打包脚本，
     * 所以改成把 themes.json 里每套皮肤写成属性选择器的令牌块，
     * 再由 head 里的引导脚本定好 data-theme / data-skin —— 首帧就是对的主题。
     * 数据来自构建期从 frontend/src/theme.js 导出的 dist/themes.json（只有这一份）。
     */
    protected static buildThemeCss(publicDir: string): string {

        let data: {skins?: Array<{id: string, light: any, dark: any}>};

        try {
            data = JSON.parse(fs.readFileSync(path.join(publicDir, "themes.json"), "utf-8"));
        } catch (ex) {
            console.warn("[theme] 没读到 themes.json（服务端页只用手写兜底色）");
            return "";
        }

        const skins = (data.skins || []).filter((one) => one && one.id);

        if (!skins.length) {
            return "";
        }

        Server.themeSkins = skins.map((one) => one.id);

        const vars = (tokens: any) => Object.keys(tokens || {}).map((k) => `    ${k}: ${tokens[k]};`).join("\n");

        const classic = skins.find((one) => one.id === "classic") || skins[0];

        const out: string[] = [];

        // 没设 data-skin 时也要有一套可用令牌（classic）
        out.push(`  :root {\n${vars(classic.light)}\n  }`);
        out.push(`  html[data-theme="dark"] {\n${vars(classic.dark)}\n  }`);
        out.push(`  @media (prefers-color-scheme: dark) {\n    html[data-theme="auto"] {\n${vars(classic.dark)}\n    }\n  }`);

        // 每套皮肤一份（浅色 / 显式深色 / 跟随系统的深色）
        skins.forEach((one) => {
            out.push(`  html[data-skin="${one.id}"] {\n${vars(one.light)}\n  }`);
            out.push(`  html[data-skin="${one.id}"][data-theme="dark"] {\n${vars(one.dark)}\n  }`);
            out.push(`  @media (prefers-color-scheme: dark) {\n    html[data-skin="${one.id}"][data-theme="auto"] {\n${vars(one.dark)}\n    }\n  }`);
        });

        // 把上面 pageCss 里写死的颜色接回令牌（同选择器、写在后面，所以优先级够）
        out.push(`  body { background: var(--bg); color: var(--text); font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif); }
  .header { background-color: var(--header-bg); border-bottom-color: var(--border); }
  .header .brand { color: var(--text); }
  .header .brand:hover { color: var(--accent); }
  .brand-icon { color: var(--accent); }
  .banner h3 { color: var(--muted); }
  .lang-switch, .seg { border-color: var(--border); background: var(--surface); }
  .lang-btn, .seg-btn { color: var(--muted); }
  .lang-btn + .lang-btn, .seg + .seg { border-left-color: var(--border); }
  .lang-btn:hover, .seg-btn:hover { background: var(--surface-2); color: var(--text); }
  .lang-btn.active, .seg-btn.active { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
  .seg select { color: var(--text); }
  .seg select option { background: var(--surface); color: var(--text); }
  a, a:visited, a:active, .dl { color: var(--link); }
  a:hover { color: var(--accent); }
  .muted, .summary, .sub, .file-icon, .dl.off, .notes .muted { color: var(--muted); }
  .site-footer, .site-footer a { color: var(--muted); }
  .site-footer { border-top-color: var(--border); }
  .site-footer a:hover { color: var(--accent); }
  .notice { background: var(--header-bg); border-color: var(--border); border-radius: var(--radius, 6px); }
  .notice svg { color: var(--muted); }
  .card { background: var(--surface); border-color: var(--border); border-radius: var(--radius, 6px); }
  .card:hover { border-color: var(--accent); }
  .card:hover .dl { color: var(--accent); }
  .card.static:hover { border-color: var(--border); }
  .card:focus-visible { outline-color: var(--ring, currentColor); }
  .badge { color: var(--accent); }
  .empty { background: var(--surface); border-color: var(--border); border-radius: var(--radius, 6px); }
  pre, code { background: var(--code-bg); }
  pre { border-color: var(--border); border-radius: var(--radius, 4px); }
  .notes { background: var(--surface-2); border-color: var(--border); color: var(--text); border-radius: var(--radius, 10px); }
  .lang-switch { border-color: var(--border); border-radius: var(--radius, 4px); background-color: color-mix(in srgb, var(--surface) 60%, transparent); }
  .lang-switch .lang-btn { color: var(--text); }
  .lang-switch .lang-btn + .lang-btn { border-left-color: var(--border); }
  .lang-switch a.lang-btn:hover { background-color: color-mix(in srgb, var(--text) 10%, transparent); color: var(--text); }
  .lang-switch .lang-btn.active { background-color: color-mix(in srgb, var(--text) 16%, transparent); }`);

        return "  <style>\n" + out.join("\n") + "\n  </style>";
    }


    /** 服务端页的主题下拉选项（id 来自 themes.json，文案用固定中英名） */
    protected static skinOptions(zh: boolean): string {

        const labels: {[id: string]: [string, string]} = {
            classic: ["经典", "Classic"],
            paper: ["纸张", "Paper"],
            ocean: ["海洋", "Ocean"],
            forest: ["森林", "Forest"],
            grape: ["葡萄", "Grape"],
            sunset: ["日落", "Sunset"],
            mono: ["黑白", "Mono"],
            neon: ["霓虹", "Neon"],
            bento: ["磁贴", "Bento"],
            glass: ["玻璃", "Glass"],
            fluid: ["自适应", "Fluid"]
        };

        const ids = Server.themeSkins.length ? Server.themeSkins : Object.keys(labels);

        return ids.map((id) => {
            const pair = labels[id];
            const text = pair ? (zh ? pair[0] : pair[1]) : id;
            return `<option value="${Server.escapeHtml(id)}">${Server.escapeHtml(text)}</option>`;
        }).join("");
    }

    /**
     * 套上站点页头，拼出完整 HTML（/backups/ 列表页与 403 页共用）。
     * 页头刻意与首页一致：左边站名、中间标语、右边语言切换；
     * 窄屏（<768px）标语隐藏，右侧那组靠 margin-left:auto 保持贴右。
     * basePath 是当前页面路径，用来拼语言切换链接（?lang=zh / ?lang=en）。
     */
    protected static pageShell(zh: boolean, title: string, body: string, basePath: string = "/"): string {

        const other = zh ? "en" : "zh";

        const otherLabel = zh ? "English" : "中文";

        const here = Server.escapeHtml(basePath || "/");

        let html = `<!DOCTYPE html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="${Server.escapeHtml(SiteMeta.iconHref())}">
<title>${Server.escapeHtml(title)}</title>
<style>
${Server.pageCss()}</style>
${Server.themeCss}
</head>
<body>
<header class="header">
  <h1><span class="brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg></span><a class="brand" href="/">${Server.siteNameFor(zh)}</a></h1>
  <div class="banner"><h3>${Server.headerBanner(zh)}</h3></div>
  <div class="right">
    <span class="lang-switch" role="group" aria-label="${zh ? "语言" : "Language"}"><span class="lang-btn active" aria-current="true">${zh ? "中文" : "English"}</span><a class="lang-btn" href="${here}" data-lang="${other}" title="${zh ? "切换到 English" : "Switch to 中文"}">${otherLabel}</a></span>
    <span class="seg" role="group" aria-label="${zh ? "明暗模式" : "Colour mode"}">
      <button type="button" class="seg-btn" data-mode="auto" title="${zh ? "跟随系统" : "System"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg></button>
      <button type="button" class="seg-btn" data-mode="light" title="${zh ? "浅色" : "Light"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
      <button type="button" class="seg-btn" data-mode="dark" title="${zh ? "深色" : "Dark"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>
    </span>
    <span class="seg" title="${zh ? "主题皮肤" : "Theme"}">
      <select id="skin-pick" aria-label="${zh ? "主题皮肤" : "Theme"}">${Server.skinOptions(zh)}</select>
    </span>
  </div>
</header>
<div class="wrap">
${body}
</div>
<footer class="site-footer">
  <p>${Server.footerText(zh)}</p>
  </footer>
  <script>
  (function () {
    var H = document.documentElement;
    var btns = [].slice.call(document.querySelectorAll('.seg-btn[data-mode]'));
    var sel = document.getElementById('skin-pick');

    // 语言：写 cookie 后跳转，地址栏不保留 ?lang=
    [].slice.call(document.querySelectorAll('.lang-btn[data-lang]')).forEach(function (a) {
      a.addEventListener('click', function () {
        var code = a.getAttribute('data-lang');
        try {
          document.cookie = 'notepad_lang=' + code + ';path=/;max-age=31536000;SameSite=Lax';
          localStorage.setItem('locale', code);
        } catch (e) {}
      });
    });

    // 从带 ?lang= 的链接进来时，把参数从地址栏去掉（服务端已按它选好语言并写了 cookie）
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.delete('lang');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
      }
    } catch (e) {}

    function refresh() {
      btns.forEach(function (b) {
        var on = b.getAttribute('data-mode') === (H.getAttribute('data-theme') || 'auto');
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (sel) sel.value = H.getAttribute('data-skin') || 'classic';
    }

    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode');
        try { localStorage.setItem('theme', mode); } catch (e) {}
        H.setAttribute('data-theme', mode);
        refresh();
      });
    });

    if (sel) sel.addEventListener('change', function () {
      try { localStorage.setItem('skin', sel.value); } catch (e) {}
      H.setAttribute('data-skin', sel.value);
      refresh();
    });

    refresh();
  })();
  </script>
  </body>
  </html>`;

      // 主题：先注入容器默认值的 meta（site-theme / site-skin），再在 </head> 前放引导脚本。
      // 访客自己选过的记在 localStorage 里，脚本会用它盖过默认值；首帧就是对的主题。
      html = SiteMeta.applyThemeMeta(html);

      html = html.replace(/(<\/head>)/i, (_match: string, close: string) => {
          return "    " + SiteMeta.themeBootScript() + "\n" + close;
      });

      return html;
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

            // 归档保留天数：只用于说明策略（真正的删除在 backend/bin/archive.sh 里做）。
            // 每次请求现读，保证页面上的天数和当前设置一致。
            const keepDays = Server.archiveKeepDays();

            let files: {name: string, size: number, mtime: Date}[] = [];

            try {
                files = fs.readdirSync(backupsDir)
                    .map((name: string) => ({name, full: path.join(backupsDir, name)}))
                    // 只列归档本身（archive.tar.gz / archive_YYYYMMDD.tar.gz）：
                    // 目录里还可能有 .gitignore 这类无关文件，别混进清单。
                    .filter((f: any) => Server.isArchiveName(f.name))
                    .filter((f: any) => fs.statSync(f.full).isFile())
                    .map((f: any) => ({name: f.name, size: fs.statSync(f.full).size, mtime: fs.statSync(f.full).mtime}))
                    .sort((a: any, b: any) => b.mtime.getTime() - a.mtime.getTime());
            } catch (ex) {
                // 还没产生过备份（首次归档之前）—— 当作空目录处理
            }

            const zh = Server.resolveLangZh(req, res);

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
      ? "备份由站点自动定时生成，不需要手动操作 —— 生成后这里就会显示清单。"
      : "Archives are created automatically on a schedule; the list shows up here once the first one exists."}</p>
</div>`;

            // 关闭下载时的提示条
            const notice = canDownload ? "" : `<div class="notice">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>
  <span>${zh
      ? "管理员已关闭归档下载，这里只列出文件清单。"
      : "Downloads are disabled by the administrator — this page only lists the archives."}</span>
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

  ${zh
      ? `<section class="notes">
    <p>这里是本实例的加密笔记归档，${canDownload ? "任何人都可以下载" : "下载已关闭，仅列出清单"}。</p>
    <p>${keepDays ? `归档只保留最近 ${keepDays} 天，更早的会自动删除。` : "归档不自动删除，全部保留。"}</p>
    <p>里面是加密后的笔记密文，没有对应口令无法解密；下载后解压，可以在另一个实例上继续使用这些笔记。</p>
  </section>`
      : `<section class="notes">
    <p>Encrypted note archives of this instance${canDownload ? " — anyone can download them" : " — downloads are off, so this page only lists them"}.</p>
    <p>${keepDays ? `Only the last ${keepDays} day(s) are kept; older archives are removed automatically.` : "Nothing is deleted automatically — every archive is kept."}</p>
    <p>They hold encrypted note blobs only, useless without the matching passphrase; unpack a downloaded archive to carry the notes over to another instance.</p>
  </section>`}
`;

            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(Server.pageShell(zh, zh ? "备份文件" : "Backups", body, "/backups/"));
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
