#!/bin/bash

set -eu

### Download all notes from notepad.mx to our own local storage folder

# Permanent URL to the latest backup（可以用 SYNC_URL 覆盖，指向别的实例的备份）
ARCHIVE_URL="${SYNC_URL:-https://notepad.mx/backups/archive.tar.gz}"

# Define directories
BIN_DIR="$(dirname "$(readlink -f "$0")")"
BACKEND_DIR="$(dirname "$BIN_DIR")"
STORAGE_DIR="$BACKEND_DIR/storage"

# storage 目录可能还不存在（新部署）——建出来，否则下面解包会失败
mkdir -p "$STORAGE_DIR"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Download the archive（下到临时文件，不污染当前目录）
echo "Downloading archive from $ARCHIVE_URL..."
wget -q "$ARCHIVE_URL" -O "$TMP"

# Extract contents to the specified directory
tar -xzf "$TMP" --strip-components=1 --skip-old-files -C "$STORAGE_DIR"

echo "Extraction successful. Notes imported into $STORAGE_DIR"
