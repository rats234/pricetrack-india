#!/usr/bin/env bash
# Builds the Chrome Web Store upload package: only files the extension needs.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./manifest.json').version")
mkdir -p dist
out="dist/pricetrack-india-$version.zip"
rm -f "$out"
zip -r -q "$out" manifest.json icons src -x '*.DS_Store'
echo "Built $out"
unzip -l "$out" | tail -n +4
