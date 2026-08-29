#!/usr/bin/env bash
# Rebuilds the React bundle into static/assets/bundle.js
set -euo pipefail
cd "$(dirname "$0")/frontend"
npm install
npx esbuild src/main.jsx \
  --bundle --minify \
  --loader:.js=jsx --loader:.jsx=jsx \
  --define:process.env.NODE_ENV='"production"' \
  --outfile=../static/assets/bundle.js
echo "Built static/assets/bundle.js"
