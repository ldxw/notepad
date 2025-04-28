# Notepad

![GitHub](https://img.shields.io/github/license/athlon1600/notepad)
![GitHub last commit](https://img.shields.io/github/last-commit/athlon1600/notepad)
![Docker Pulls](https://img.shields.io/docker/pulls/athlon1600/notepad)

一个简单的基于 Web 的记事本, 用于在线编写和安全存储笔记. 适用于在人员或设备之间轻松共享文本.

- 无需注册流程.使用密码短语作为登录方式.
- 客户端完全加密.除了你之外, 没有人可以读取你的笔记.
- 极其简约和轻量级

## :star: Demo

此应用程序的精确版本:

- https://notepad.mx


## :whale2: 使用 Docker 部署

租用服务器 [linode.com](https://www.linode.com/lp/refer/?r=cee8aa429cd4cbb5a6e6d1ebfd8986f661d8ef4e)

在新服务器上安装 Docker 19 及以上版本:

```shell
curl -sSL https://get.docker.com/ | sh
```

接着运行以下命令:

```shell
git clone https://github.com/Athlon1600/notepad.git
cd notepad
docker compose up -d
```

:heavy_check_mark: 应用程序将在 3000 端口运行0

你也可以选择运行以下命令:

```shell
docker run -d -p 3000:3000 athlon1600/notepad
```

查看 Docker Hub 页面:  
https://hub.docker.com/r/athlon1600/notepad

## :hammer: 手动部署到生产环境

租用服务器后 [linode.com](https://www.linode.com/lp/refer/?r=cee8aa429cd4cbb5a6e6d1ebfd8986f661d8ef4e)

通过以下三行命令可将项目部署到生产环境:

```shell
git clone https://github.com/Athlon1600/notepad.git
cd notepad
npm run build && npm run start
```

此过程会先构建 Vue 前端，然后将构建产物移动到后端应用的 /public 目录，前端将从该目录提供服务.

:heavy_check_mark: 应用程序将在 3000 端口可用

## :globe_with_meridians: Caddy 服务器

若你希望直接获得 HTTPS 支持，需安装 Caddy:

```shell
wget -qO- https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_amd64.tar.gz | tar -xz && rm -f caddy_2.8.4_linux_amd64.tar.gz LICENSE README.md && chmod +x caddy && mv caddy /usr/local/bin/caddy
```

务必修改 `backend/etc/Caddyfile` 将其中的 `notepad.mx` 替换为你自己的域名，然后运行:

```shell
caddy start --config ./backend/etc/Caddyfile 
```

## :closed_lock_with_key: 工作原理

- 使用密码短语登录，该密码短语会生成一个 32 字节（即 64 个十六进制字符）的哈希值
- 前 16 字节是你的 **authentication key**  用于在 API 调用传输数据时进行身份验证
- 后 16 字节是你的 **encryption key** 用于加密文本数据
- 加密密钥不会离开你的浏览器.
- 所有笔记以加密文件的形式存储在 `storage/{storage_key}` 其中 storage_key = `md5(认证密钥)`

请查看下图:

![scrypt](https://github.com/Athlon1600/notepad/assets/1063088/aed67aae-bd10-4917-a149-fc2db0ad1d17)

这确保了除你之外，无人知晓笔记内容以及它们在服务器上的存储位置.

![storage](https://i.imgur.com/cXgoRLX.png)

## :arrows_counterclockwise: 在不同实例间共享笔记

只要密码短语使用相同的盐值 (默认盐值为 `notepad.mx`
定义在 `frontend/src/config.js` 中) 进行哈希处理，在一台服务器上创建的笔记可与该应用程序的其他部署兼.

这使得可以将笔记从一台服务器导入到另一台服务器，或者在主实例关闭时托管一个备份镜像实例

你可以从以下链接下载在主 notepad.mx 实例上创建的所有笔记:

- https://notepad.mx/archive.tar.gz

将下载内容解压到 `backend/storage`, 目录，使用你应用程序的用户就能访问这些笔记.

还有一个命令可自动完成上述操作:

```shell
docker compose exec -it backend sh -c "sh backend/bin/sync.sh"
```

## 故障排除

> ERROR in [prerender-spa-plugin] Unable to prerender all routes!  
> ERROR in Failed to launch chrome!  
> error while loading shared libraries: libX11-xcb.so.1: cannot open shared object file: No such file or directory

请确保你的系统安装了所有必要的依赖项. 可查看此链接 - https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#chrome-doesnt-launch-on-linux

## 待办事项

- 将前端重写为使用 TypeScript
- 使用 WebSocket 以更好地支持多个会话编辑同一文档的场景
- 添加使用 Redis 存储笔记的选项
- 支持通过命令行使用该应用程序
- 更新编辑器，允许通过换行将长文本划分为多个子部分

## 版本

若你想继续使用 v1 版本，可访问:  
https://github.com/Athlon1600/notepad/tree/v1.0.0-rc.1

## 外部链接

- https://hub.docker.com/r/athlon1600/notepad
- https://ricmoo.github.io/scrypt-js/
- http://aes.online-domain-tools.com/
- https://www.proxynova.com/tools/brute-force-calculator
