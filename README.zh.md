# Notepad

[English](README.md) | **简体中文**

![GitHub last commit](https://img.shields.io/github/last-commit/athlon1600/notepad)
![Docker Pulls](https://img.shields.io/docker/pulls/athlon1600/notepad)
![GitHub](https://img.shields.io/github/license/athlon1600/notepad)

一个简单的在线记事本，用来写东西、并把笔记安全地存在网上。
在人与人、设备与设备之间分享文本很方便。

- 无需注册流程，直接用一句话口令（passphrase）当账号
- 全程客户端加密，除了你自己没人能读出笔记内容
- 极简、极轻

## :star: 在线演示

这个应用的线上版本：

- https://notepad.mx

## :whale2: 用 Docker 部署

可以在 [linode.com](https://www.linode.com/lp/refer/?r=cee8aa429cd4cbb5a6e6d1ebfd8986f661d8ef4e) 免费开一台服务器。

在新服务器上装 Docker 19+：

```shell
curl -sSL https://get.docker.com/ | sh
```

然后执行：

```shell
git clone https://github.com/Athlon1600/notepad.git
cd notepad
docker compose up -d
```

:heavy_check_mark: 应用会跑在 3000 端口

## :hammer: 手动部署到生产环境

可以在 [linode.com](https://www.linode.com/lp/refer/?r=cee8aa429cd4cbb5a6e6d1ebfd8986f661d8ef4e) 免费开一台服务器。

三行命令把整套东西部署到生产环境：

```shell
git clone https://github.com/Athlon1600/notepad.git
cd notepad
npm run build && npm run start
```

它会先构建 Vue 前端，然后把产出的 bundle 挪到后端应用的 `/public` 目录，由后端来提供前端页面。

:heavy_check_mark: 应用随后即可通过 3000 端口访问

## :globe_with_meridians: Caddy 服务器

如果想要开箱即用的 HTTPS，建议装 Caddy：

```shell
wget -qO- https://raw.githubusercontent.com/Athlon1600/useful/master/caddy/caddy_linux_amd64.sh | bash
```

记得修改 `etc/Caddyfile`，把 `notepad.mx` 换成你自己的域名，然后运行：

```shell
caddy start --config ./etc/Caddyfile 
```

## :closed_lock_with_key: 工作原理

- 你用一句话口令登录，口令会生成 32 字节（即 64 个十六进制字符）的哈希值
- 前 16 字节是**认证密钥**，用于收发数据时的 API 调用
- 后 16 字节是**加密密钥**，用来加密笔记文本
- 加密密钥永远不会离开你的浏览器
- 所有笔记都以加密文件的形式存放在 `storage/{storage_key}`，其中 storage_key = `md5(认证密钥)`

见下图：

![scrypt](https://github.com/Athlon1600/notepad/assets/1063088/aed67aae-bd10-4917-a149-fc2db0ad1d17)

这样一来，除了你自己，没人知道你的笔记内容，也没人知道它们在服务器上的存放位置。

![storage](https://i.imgur.com/cXgoRLX.png)

## :arrows_counterclockwise: 在不同实例之间共享笔记

在一台服务器上创建的笔记，与这个应用的其它所有部署都是兼容的 ——
只要口令用同一个 salt 做哈希（默认是 `notepad.mx`，即 `frontend/src/config.js` 里的 `APP_KEY`）。

这个 salt 可以用 **`SITE_SALT`** 在运行时指定（无需重新构建）：给自己的实例设一个自己的值，
它的笔记就自成一个命名空间。注意：之后改这个值，用旧 salt 建的笔记在界面上就找不回来了 —— 改之前先备份。

因此你可以把笔记从一台服务器导入到另一台，或者拿它做一个备份镜像站，以防主站关停。

你可以在这里下载主站 **notepad.mx** 上创建的全部笔记：

- https://notepad.mx/backups/archive.tar.gz

把它们解包到 `backend/storage`，之后所有使用你这个应用的人就都能看到这些笔记了。

也有一条命令可以自动完成上述全部动作：

```shell
docker exec -it notepad sh -c "sh backend/bin/sync.sh"
```

你还可以定期做自己的备份，用这条命令（通常交给 cron 跑）：

```shell
docker exec -it notepad sh -c "sh backend/bin/archive.sh"
```

## :globe_with_meridians: Languages / 多语言

界面自带 **English** 和 **简体中文**。每个页面（包括首页）的头部都有语言切换器（English / 中文），
选择结果会记在 `localStorage` 里。首次访问时应用会自动识别浏览器语言（`zh*` → 中文，其它一律英文）。

所有文案都放在 `frontend/src/i18n.js` —— 一个手写的极小 i18n 模块（不引入任何额外依赖）：

```js
import {t, setLocale, locale} from "../i18n";

t("home.loginTitle");   // 按当前语言翻译某个 key
setLocale("zh");        // 切换语言（会持久化，并同步 <html lang> 与 <title>）
```

缺失的 key 会先回退到英文，再回退到 key 本身，所以只翻译一部分也是安全的。

### 增加一门语言

1. 复制 `frontend/src/i18n.js` 中 `messages` 里的 `en` 块，把值翻译掉。
2. 在同一个文件的 `availableLocales` 里加一条 `{code: "...", label: "..."}`。

就这些 —— 切换器会自动带上它。

## :label: 页面元信息（运行时变量）

`<title>`、`<meta name="description">`、`<meta name="keywords">`、`<meta name="author">` 的默认值在**构建期**从
`frontend/site.config.js` 写进构建好的 `index.html`。之后可以在**容器启动时**用环境变量覆盖 ——
无需重新构建。

所有支持的变量（页面元信息、`SITE_LANG`、`TZ`、`ARCHIVE_CRON`）都在 **`.env.example`** 里列好并带注释，
复制到 `docker-compose.yml` 旁边改一下即可：

```shell
cp .env.example .env
docker compose up -d
```

```bash
docker run -d -p 3000:3000 \
  -e SITE_TITLE="My Notepad" \
  -e SITE_DESCRIPTION="Notes, stored securely online" \
  -e SITE_KEYWORDS="notepad,encrypted notes" \
  -e SITE_AUTHOR="me" \
  -e SITE_LANG="zh" \
  ldxw/notepad
```

或者通过 `docker-compose.yml` / 旁边的 `.env` 文件：

```yaml
    environment:
      SITE_TITLE: ${SITE_TITLE:-}
      SITE_DESCRIPTION: ${SITE_DESCRIPTION:-}
      SITE_KEYWORDS: ${SITE_KEYWORDS:-}
      SITE_AUTHOR: ${SITE_AUTHOR:-}
      SITE_LANG: ${SITE_LANG:-}
```

`SITE_LANG` 用来设**默认界面语言**（`auto` = 跟随浏览器，也是默认值；`zh` / `en` 直接指定）。
它以 `<meta name="default-locale">` 的形式注入，只对**还没选过语言的访客**生效 ——
访客在头部手动选过的语言记在 `localStorage` 里，优先级更高。

`backend/src/SiteMeta.ts` 会在启动时重写一次被服务的 `index.html`（值都做了转义），
所以覆盖后的值是写在 HTML 里的 —— 搜索引擎同样能看到。任何未设置或为空的变量都会保留构建期默认值，
启动日志里会列出被覆盖了哪些。

站点图标同理：`SITE_ICON` 填完整 URL 或 `/my.ico` 这样的路径即可替换内置的 `favicon.ico`；
留空则继续用默认图标。

### 中英两套值

`SITE_TITLE`、`SITE_DESCRIPTION`、`SITE_KEYWORDS`、`SITE_NAME` 都支持 `_ZH` / `_EN` 后缀，
所以一份部署可以同时带中英两套：

```bash
SITE_NAME_ZH="我的记事本"    SITE_NAME_EN="My Notepad"
SITE_TITLE_ZH="在线记事本"    SITE_TITLE_EN="Online Notepad - store your notes securely online"
```

切换界面语言时，页头名字、`<title>` 和 description / keywords 会一起跟着换 ——
不会再出现「英文页面顶着中文标题」。不带后缀的 `SITE_TITLE=…` 依然有效，作为所有语言的通用兜底。
静态 HTML（爬虫不执行 JS 时看到的那份）用 `SITE_LANG` 指定语言的一套；`SITE_LANG` 没设则用 `_EN` 那套。

## :alarm_clock: 自动备份（容器内 cron）

镜像每天会自动跑一次归档任务，你不必自己再配 cron：

```bash
docker exec -it notepad sh -c "sh backend/bin/archive.sh"   # 定时任务跑的就是这条
```

`backend/storage` 会在每天 **03:30** 被打包进 `backend/public/backups/`
（这两个目录都是宿主机挂载的卷，所以归档结果能扛住容器重启）。

时间点和时区都是环境变量，同样无需重新构建：

```yaml
    environment:
      TZ: Asia/Shanghai          # 下面的小时按这个时区解释（容器默认 UTC）
      ARCHIVE_CRON: "30 3 * * *" # 标准 5 段 cron；填 "off" 可关闭
```

crontab 由 `docker/setup-cron.sh` 在容器启动时写入，任务输出落在容器内的
`/var/log/archive-cron.log`：

```bash
docker exec -it notepad tail -n 20 /var/log/archive-cron.log
docker exec -it notepad ls -lh backend/public/backups/
```

## 排错

### 预渲染

`npm run build` 会在 webpack 之后把首页预渲染成静态 HTML，用的是官方
Chrome for Testing 的 `chrome-headless-shell` 加 `--dump-dom`（`frontend/scripts/prerender.mjs`）。
x64 和 arm64 都能跑：Dockerfile 会按 `TARGETARCH` 下载对应的构建，并执行
`chrome-headless-shell --version` 验证它起得来。

原来基于 puppeteer 的插件已经移除 —— puppeteer@1.20 只带 x86_64 的 Chromium，
多架构构建里的 arm64 那条腿永远拉不起来。

在 Docker 之外，把 `CHROME_BIN` 指向任意 Chrome/Chromium 就能本地预渲染；
找不到浏览器时会打一条警告并跳过，所以裸跑 `npm run build` 依然会成功。

> ERROR in [prerender-spa-plugin] Unable to prerender all routes!  
> ERROR in Failed to launch chrome!  
> error while loading shared libraries: libX11-xcb.so.1: cannot open shared object file: No such file or directory

请确认系统装齐了所需依赖，参见：
- https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#chrome-doesnt-launch-on-linux

## 待办

- 把前端改写成 TypeScript
- 用 websocket 更好地支持多人同时编辑同一份文档
- 增加用 Redis 存储笔记的选项
- 支持通过命令行使用本应用
- 改进编辑器，允许用换行把长文本切分成多个小节

## 版本

如果你想继续用 v1，看这里：  
https://github.com/Athlon1600/notepad/tree/v1.0.0-rc.1

## 外部链接

- https://hub.docker.com/r/athlon1600/notepad
- https://ricmoo.github.io/scrypt-js/
- https://www.proxynova.com/tools/brute-force-calculator
