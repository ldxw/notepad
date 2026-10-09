#!/bin/sh
#
# 启动容器内的定时归档（cron）。
#
# 干的事和手动执行完全一样 —— 每天把 backend/storage 打包成 archive.tar.gz 放到
# backend/public/backups/（即 backend/bin/archive.sh）：
#
#   docker exec -it notepad sh -c "sh backend/bin/archive.sh"
#
# 时间用环境变量 ARCHIVE_CRON 调整（标准 5 段 cron 表达式；容器时区由 TZ 决定）：
#   ARCHIVE_CRON="30 3 * * *"   每天 03:30（默认）
#   ARCHIVE_CRON="0 4 * * *"    每天 04:00
#   ARCHIVE_CRON="30 2 * * 0"   每周日 02:30
#   ARCHIVE_CRON="off"          关闭定时归档
#
# 注意：archive.sh 的 shebang 是 bash，但 alpine 里没有 bash —— 所以这里显式用
# `sh` 调用（和官方 README 给的命令一致）。脚本只用到 tar/cp/mv/date/readlink，
# busybox 全都有，不需要额外装 bash。
#
set -eu

CRONTAB_DIR="/etc/crontabs"
CRONTAB_FILE="$CRONTAB_DIR/root"
LOG_FILE="/var/log/archive-cron.log"

SCHEDULE="${ARCHIVE_CRON:-30 3 * * *}"

if [ "$SCHEDULE" = "off" ] || [ "$SCHEDULE" = "0" ]; then
    echo "[cron] ARCHIVE_CRON=$SCHEDULE → 定时归档不启动"
    exit 0
fi

mkdir -p "$CRONTAB_DIR"

cat > "$CRONTAB_FILE" <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# 定时归档笔记（archive.sh 会在当前目录生成临时 tar，所以固定切到 /app/backend）
$SCHEDULE cd /app/backend && sh bin/archive.sh >> $LOG_FILE 2>&1
EOF

chmod 600 "$CRONTAB_FILE"

# 启动 cron 守护进程：-c 指定 crontab 目录，-b 后台运行（dcron / busybox crond 都支持）
crond -c "$CRONTAB_DIR" -b

echo "[cron] 归档定时已启动：$SCHEDULE（时区 TZ=${TZ:-UTC}，日志容器内 $LOG_FILE）"
