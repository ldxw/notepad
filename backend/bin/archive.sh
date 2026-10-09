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

# 用 printf 而不是 echo -e：这个脚本经常被 `sh archive.sh`（dash）调用，
# dash 的 echo 不支持 -e，也不认 \u 转义。
printf '\342\234\205 Archive created in %s\n' "$BACKUPS_DIR"
