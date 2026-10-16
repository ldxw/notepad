#!/bin/bash

set -eu

# Define directories
BIN_DIR="$(dirname "$(readlink -f "$0")")"
BACKEND_DIR="$(dirname "$BIN_DIR")"
STORAGE_DIR="$BACKEND_DIR/storage"
BACKUPS_DIR="$BACKEND_DIR/public/backups"

# 备份目录可能还不存在（新部署，或者 public/ 是挂载进来的空目录）——
# 建出来就行，不要像原来那样直接报 "not found" 退出，否则容器内的每日归档永远跑不成。
mkdir -p "$BACKUPS_DIR"

if [ ! -d "$STORAGE_DIR" ]; then
  echo "storage directory ($STORAGE_DIR) not found."
  exit 1
fi

# 先写到临时文件、再原子改名：这样别人下载 archive.tar.gz 时不会读到写了一半的包
TMP="$(mktemp "$BACKUPS_DIR/.archive.XXXXXX")"

# change to backend directory before compression
tar -czf "$TMP" -C "$BACKEND_DIR" storage

## make a dated copy of it
cp "$TMP" "$BACKUPS_DIR/archive_$(date +%Y%m%d).tar.gz"
mv "$TMP" "$BACKUPS_DIR/archive.tar.gz"

# ── 归档保留天数（运行时变量 ARCHIVE_KEEP_DAYS）────────────────────────────
#   不设 / 0 / off / false / no / disabled  → 保留全部（默认，绝不自动删东西）
#   正整数 N                                → 只保留最近 N 天生成的
#                                             archive_YYYYMMDD.tar.gz，更早的删掉；
#                                             archive.tar.gz（最新一份）永远保留。
#   值不合法（非正整数）→ 按“保留全部”处理，只打印一句提示，不让脚本失败。
#
# 只按修改时间判断，且只匹配 archive_<YYYYMMDD>.tar.gz 这一种文件名，
# 不会碰别的文件。用 find 而不是 -delete：Alpine 的 busybox find 不一定支持 -delete。
KEEP_RAW="${ARCHIVE_KEEP_DAYS:-}"

case "$KEEP_RAW" in
  ""|0|off|OFF|false|FALSE|no|NO|disable|disabled)
    KEEP=""
    ;;
  *[!0-9]*)
    KEEP=""
    printf 'ARCHIVE_KEEP_DAYS="%s" is not a positive integer - keeping every archive\n' "$KEEP_RAW"
    ;;
  *)
    KEEP="$KEEP_RAW"
    ;;
esac

if [ -n "$KEEP" ]; then

  # find 的 -mtime +N 是「修改时间超过 N*24 小时」，所以「保留最近 N 天」要用 N-1
  if [ "$KEEP" -gt 1 ]; then
    AGE=$((KEEP - 1))
  else
    AGE=0
  fi

  REMOVED=0

  for f in "$BACKUPS_DIR"/archive_*.tar.gz; do

    [ -f "$f" ] || continue

    if [ -n "$(find "$f" -maxdepth 0 -mtime +"$AGE" 2>/dev/null)" ]; then
      rm -f "$f"
      REMOVED=$((REMOVED + 1))
      printf 'removed (older than %s day(s)): %s\n' "$KEEP" "$(basename "$f")"
    fi
  done

  printf 'retention: keeping last %s day(s), removed %s archive(s)\n' "$KEEP" "$REMOVED"
else
  printf 'retention: ARCHIVE_KEEP_DAYS not set - keeping every archive\n'
fi

# 无条件清掉中断留下的临时包（超过 1 天的）—— 它们永远不会出现在列表页里，
# 只占空间，所以和保留天数无关，每次都顺手收拾。
for f in "$BACKUPS_DIR"/.archive.*; do
  [ -f "$f" ] || continue
  if [ -n "$(find "$f" -maxdepth 0 -mtime +0 2>/dev/null)" ]; then
    rm -f "$f"
  fi
done

# 用 printf 而不是 echo -e：这个脚本经常被 `sh archive.sh`（dash）调用，
# dash 的 echo 不支持 -e，也不认 \u 转义。
printf '\342\234\205 Archive created in %s\n' "$BACKUPS_DIR"
