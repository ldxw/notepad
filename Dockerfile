FROM node:24-alpine3.23 AS builder
WORKDIR /app

COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for both frontend and backend
RUN npm install --prefix ./backend/
RUN npm install --prefix ./frontend/


# 预渲染（Chrome for Testing 的 headless-shell）所在的阶段。
# x64 用 linux64、arm64 用 linux-arm64，都是官方二进制；下面按 TARGETARCH 自动选。
FROM node:24-bookworm AS vue-build
WORKDIR /app

# headless-shell 需要的系统库 + 解压工具（库名逐个对照过 bookworm 包索引）
RUN apt-get -o Acquire::Retries=3 update && \
    apt-get install -yq --no-install-recommends unzip ca-certificates \
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxext6 \
        libx11-6 libxcb1 libgbm1 libasound2 libpango-1.0-0 libcairo2 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 下载对应架构的 Chrome，并就地验证它能跑起来（arm64 那条腿会走 QEMU 模拟，
# 这一步跑通就等于证明了模拟环境里 Chrome 可用）
ARG CHROME_VERSION=157.0.8094.0
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) PLAT=linux64 ;; \
      arm64) PLAT=linux-arm64 ;; \
      *) echo "不支持的架构: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/shell.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/${PLAT}/chrome-headless-shell-${PLAT}.zip"; \
    mkdir -p /opt/chrome; \
    unzip -q -o /tmp/shell.zip -d /opt/chrome; \
    rm -f /tmp/shell.zip; \
    ln -sf "/opt/chrome/chrome-headless-shell-${PLAT}/chrome-headless-shell" /usr/local/bin/chrome-headless-shell; \
    chrome-headless-shell --version
ENV CHROME_BIN=/usr/local/bin/chrome-headless-shell

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

# 冒烟测试：确认 archive.sh 在镜像自带的 shell（Alpine 的 busybox ash）下能跑通。
# 它经常以 `sh backend/bin/archive.sh` 的方式被调用（docker exec 或容器内 cron），
# 之前遇到 public/backups 目录不存在就直接报错退出 —— 构建时跑一遍，不兼容当场失败。
RUN set -eux; \
    rm -rf /tmp/smoke; \
    mkdir -p /tmp/smoke/backend/bin /tmp/smoke/backend/storage; \
    cp /app/backend/bin/archive.sh /tmp/smoke/backend/bin/; \
    echo "smoke-test-note" > /tmp/smoke/backend/storage/note.txt; \
    sh /tmp/smoke/backend/bin/archive.sh; \
    tar -tzf /tmp/smoke/backend/public/backups/archive.tar.gz | grep -q "storage/note.txt"; \
    rm -rf /tmp/smoke

# 容器内定时归档（每天执行 backend/bin/archive.sh，时间可用 ARCHIVE_CRON 环境变量调整）
COPY ./docker/setup-cron.sh ./docker/setup-cron.sh
RUN chmod +x ./docker/setup-cron.sh

EXPOSE 3000

#CMD ["sleep", "1d"]
CMD /bin/sh -c "sh /app/docker/setup-cron.sh && cd frontend && npm run copy:backend && cd ../backend && npm run start"
