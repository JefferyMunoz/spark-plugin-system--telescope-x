#!/bin/bash

REGISTRY="https://gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/"
USERNAME="srd17611381820"
PASS_BASE64="MjU1NDU5ZDg3NWQwNDVhNzJkY2IyNTVhYzUzNDliOGE="
EMAIL="17611381820@163.com"

echo "[Deploy] 正在准备发布环境..."

cat > .npmrc <<EOF
registry=$REGISTRY
always-auth=true
//gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/:username=$USERNAME
//gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/:_password=$PASS_BASE64
//gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/:email=$EMAIL
EOF

echo "[Deploy] 凭证注入完成，执行 yarn build..."

if yarn build; then
    echo "[Deploy] 构建成功，开始进入 dist 执行 npm publish..."
    cp .npmrc dist/
    cd dist
    if npm publish; then
        echo "[Deploy] ✅ 发布成功！"
        cd ..
    else
        echo "[Deploy] ❌ 发布失败。"
        cd ..
        exit 1
    fi
else
    echo "[Deploy] ❌ 构建失败。"
    exit 1
fi
