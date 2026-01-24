# TeleScopeX (闪搭X)

开发者全能瑞士军刀，为公司内部开发者打造的高效插件集成箱。

## 核心功能 (Features)

1.  **Smart Parser (智能解析器)**
    *   **命令**: `json`, `base64`, `ts`, `parse`
    *   **功能**: 自动识别剪贴板内容。支持 JSON 格式化与压缩、Base64 编解码、JSON 转 TypeScript Interface。

2.  **Port Killer (端口杀手)**
    *   **命令**: `:端口号` (如 `:8080`), `kill`
    *   **功能**: 快速查询占用端口的进程信息，并支持一键杀死进程。

3.  **Transformer (万能转换器)**
    *   **命令**: `time`, `md5`, `case`
    *   **功能**:
        *   `time`: 时间戳与日期互转。
        *   `md5`: 字符串 MD5/SHA256 哈希计算。
        *   `case`: 命名风格转换 (camelCase, snake_case, PascalCase, UPPER_CASE)。

## 开发与调试

### 安装依赖
```bash
cd spark-plugin-ui--telescope-x
npm install
```

### 启动开发服务
```bash
npm run dev
```
默认端口：`http://localhost:8085/` (可在 `vite.config.ts` 中调整)

### 构建
```bash
npm run build
```

## 插件配置

插件的配置文件位于 `public/plugin.json`，已配置多 Feature 触发模式，适配 Spark 的 `cmds` 协议。
