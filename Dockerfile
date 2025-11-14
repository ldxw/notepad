FROM node:20-alpine3.18 AS builder
WORKDIR /app

COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for both frontend and backend
RUN npm install --prefix ./backend/
RUN npm install --prefix ./frontend/

ENV VUE_APP_META_DESCRIPTION="小窝笔记,自动加密的网页版记事本,无需注册." \
    VUE_APP_META_KEYWORDS="小窝笔记, 云记事本, 在线记事本, 带密码的在线记事本, 加密记事本, 网页版记事本, 网络记事本, 在线写字板, 在线文本编辑器, 网页记事本, SimpleNote 替代品, Standard Notes 替代品" \
    VUE_APP_PAGE_TITLE="小窝笔记 - 在线存储您的笔记" \
    VUE_APP_COMPONENT_TITLE="note.ldxw.top" \
    VUE_APP_APP_KEY="note.ldxw.top" \
    VUE_APP_H3_TITLE="在线储存您的笔记" \
    VUE_APP_FAVICON_URL="https://fastly.jsdelivr.net/gh/ldxw/cdn@master/logo/svg/logo/32x32/favicon.ico"

RUN cd frontend && npm run build

FROM node:20-alpine3.18 as vue-build
# FROM node:20-bullseye as vue-build
WORKDIR /app
# RUN apt-get update && apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/frontend ./frontend
COPY ./frontend ./frontend
RUN cd frontend && npm run build

ENV VUE_APP_META_DESCRIPTION="小窝笔记,自动加密的网页版记事本,无需注册." \
    VUE_APP_META_KEYWORDS="小窝笔记, 云记事本, 在线记事本, 带密码的在线记事本, 加密记事本, 网页版记事本, 网络记事本, 在线写字板, 在线文本编辑器, 网页记事本, SimpleNote 替代品, Standard Notes 替代品" \
    VUE_APP_PAGE_TITLE="小窝笔记 - 在线存储您的笔记" \
    VUE_APP_COMPONENT_TITLE="note.ldxw.top" \
    VUE_APP_APP_KEY="note.ldxw.top" \
    VUE_APP_H3_TITLE="在线储存您的笔记" \
    VUE_APP_FAVICON_URL="https://fastly.jsdelivr.net/gh/ldxw/cdn@master/logo/svg/logo/32x32/favicon.ico"


FROM node:20-alpine3.18 AS runner
WORKDIR /app

COPY --from=vue-build /app/frontend ./frontend
COPY --from=builder /app/backend ./backend

RUN apk --update add tar

COPY ./backend ./backend
RUN cd backend && npm run build

ENV VUE_APP_META_DESCRIPTION="小窝笔记,自动加密的网页版记事本,无需注册." \
    VUE_APP_META_KEYWORDS="小窝笔记, 云记事本, 在线记事本, 带密码的在线记事本, 加密记事本, 网页版记事本, 网络记事本, 在线写字板, 在线文本编辑器, 网页记事本, SimpleNote 替代品, Standard Notes 替代品" \
    VUE_APP_PAGE_TITLE="小窝笔记 - 在线存储您的笔记" \
    VUE_APP_COMPONENT_TITLE="note.ldxw.top" \
    VUE_APP_APP_KEY="note.ldxw.top" \
    VUE_APP_H3_TITLE="在线储存您的笔记" \
    VUE_APP_FAVICON_URL="https://fastly.jsdelivr.net/gh/ldxw/cdn@master/logo/svg/logo/32x32/favicon.ico"

EXPOSE 3000

#CMD ["sleep", "1d"]
#CMD /bin/sh -c "cd frontend && npm run copy:backend && cd ../backend && npm run serve"
CMD ["/bin/sh", "-c", "cd frontend && npm run copy:backend && cd ../backend && npm run serve"]
