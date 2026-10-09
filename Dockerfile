FROM node:24-alpine3.23 AS builder
WORKDIR /app

COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for both frontend and backend
RUN npm install --prefix ./backend/
RUN npm install --prefix ./frontend/


# 注意：vue 的生产构建默认不做 prerender（原因见 frontend/webpack.config.js）。
# 若要用 PRERENDER=true 启用预渲染，本阶段需要装回 Chromium 的系统库（libnss3 等），
# 并且只能构建 linux/amd64 —— puppeteer 1.20 没有 arm64 版 Chromium，arm64 上必然失败。
FROM node:24-bookworm AS vue-build
WORKDIR /app

COPY --from=builder /app/frontend ./frontend
COPY ./frontend ./frontend
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
