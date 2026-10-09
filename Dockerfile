FROM node:24-alpine3.23 AS builder
WORKDIR /app

COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for both frontend and backend
RUN npm install --prefix ./backend/
RUN npm install --prefix ./frontend/


# 这一层只为 vue 生产构建里的 prerender 准备系统库（它需要一个能跑起来的 Chromium）。
# 必须用仍在维护的 Debian 版本：原来的 bullseye(Debian 11) 已于 2026-08-31 结束 LTS，
# 安全仓库里的 deb11u* 包被撤下，apt 会 404 → exit 100。故改用 bookworm(Debian 12)。
FROM node:24-bookworm AS vue-build
WORKDIR /app

RUN apt-get -o Acquire::Retries=3 update && \
    apt-get install -yq gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 \
        libatspi2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 \
        libfontconfig1 libgbm1 libgcc-s1 libgconf-2-4 libgdk-pixbuf2.0-0 \
        libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
        libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
        libxdamage1 libxext6 libxfixes3 libxi6 libxkbcommon0 libxrandr2 \
        libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 \
        lsb-release xdg-utils wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/frontend ./frontend
COPY ./frontend ./frontend

# prerender 需要 puppeteer 自带的 Chromium，而它是靠 npm install 的 install 脚本下载的。
# 较新的 npm 会跳过未授权的生命周期脚本（npm 11: "install-scripts ... not yet covered by
# allowScripts: puppeteer@1.20.0 (install: node install.js)"），一旦被跳过，构建就会报
# "Failed to launch chrome! ... ENOENT"。所以这里显式下载一次（带重试），
# 下不下来立刻失败，错误信息清楚，不会拖到 webpack 阶段才暴露。
RUN cd frontend \
    && for i in 1 2 3; do \
         if [ -f node_modules/puppeteer/.local-chromium/linux-*/chrome-linux/chrome ]; then \
           echo "Chromium 已存在，跳过下载"; break; \
         fi; \
         echo "第 $i 次下载 Chromium..."; \
         node node_modules/puppeteer/install.js && break || sleep 10; \
       done \
    && ls -l node_modules/puppeteer/.local-chromium/linux-*/chrome-linux/chrome

RUN cd frontend && npm run build


FROM node:24-alpine3.23 AS runner
WORKDIR /app

COPY --from=vue-build /app/frontend ./frontend
COPY --from=builder /app/backend ./backend

RUN apk --update add tar dcron tzdata

COPY ./backend ./backend
RUN cd backend && npm run build

# 容器内定时归档（每天执行 backend/bin/archive.sh，时间可用 ARCHIVE_CRON 环境变量调整）
COPY ./docker/setup-cron.sh ./docker/setup-cron.sh
RUN chmod +x ./docker/setup-cron.sh

EXPOSE 3000

#CMD ["sleep", "1d"]
CMD /bin/sh -c "sh /app/docker/setup-cron.sh && cd frontend && npm run copy:backend && cd ../backend && npm run start"
