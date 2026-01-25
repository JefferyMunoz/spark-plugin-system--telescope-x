#!/bin/bash

# Define registry and credentials
REGISTRY="https://gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/"
NPMRC_PATH=".npmrc"

echo "Creating temporary .npmrc for authentication..."
cat <<EOF > $NPMRC_PATH
registry=https://gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/
always-auth=true
//gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/:username=srd17611381820
//gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/:_password=M2QxOGM1MzQ0ZWNkNzAzOTBmYjY2ZmVhYzk5MDNlOTQ=
//gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/:email=17611381820@163.com
EOF

echo "Building plugin..."
npm run build

echo "Publishing to registry: $REGISTRY"
cd dist
cp ../$NPMRC_PATH .
npm publish --registry=$REGISTRY
rm $NPMRC_PATH
cd ..

# Cleanup
echo "Cleaning up temporary .npmrc..."
rm $NPMRC_PATH

echo "Publication process complete."
