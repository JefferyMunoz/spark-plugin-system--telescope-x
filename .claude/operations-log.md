
## 转换矩阵增强计划 - 2026-01-23
- **Base64**: 完善 UTF-8 支持，确保中文不乱码。
- **JSON**: 支持普通 JSON 压缩、美化，以及从类似 JS 对象的字符串（不带双引号的 key）转换为标准 JSON。
- **Time**: 实现 Date string -> Timestamp (s/ms) 和 Timestamp -> ISO/Locale Date。
- **Case Converter**: 实现 snake_case, camelCase, PascalCase, kebab-case 全家桶。
- **Hacker Tools**: 
  - JWT Decode (无需密钥查看 payload)。
  - Unicode / HTML Entity 互转。
  - URI Component 深度编解码。
  - Hex / Decimal / Binary 进制转换。

## 最终重构目标：TeleScopeX 浅色智选版
- **主题**：Geist Light (白色背景, 极简灰边, 蓝色高亮)。
- **交互**：完全适配键盘（上下选择 + 回车复制）。
- **智能引擎规则**：
  1. **JSON 匹配** -> 格式化排第一。
  2. **Base64 特征** -> 解码排第一。
  3. **数字特征(10/13位)** -> 时间戳转日期排第一。
  4. **JWT 特征** -> 解码排第一。
  5. **URL 包含 %** -> URL 解码排第一。
  6. **代码标识符特征** -> 变量名命名法互转。

## 重构目标：TeleScopeX 3.0 全能智选
- **Base64 修复**：采用与原生 atob/btoa 高度一致的 UTF-8 兼容算法。
- **功能矩阵扩充**：
  - 核心编解码：Base64, URL, HTML, Hex。
  - 格式化专家：JSON 美化/压缩/修复, SQL 格式化(基础)。
  - 命名法大师：大/小驼峰, 下划线, 中划线, 常量, 标题。
  - 安全摘要：MD5, SHA256 (基于 SubtleCrypto)。
  - 时间戳巨匠：秒/毫秒 互转, 相对时间。
  - 统计助手：字数/统计/行数。
- **视觉反馈**：保留浅色 Raycast 风格，优化中文排版。
## 2026-01-27 23:40
- 任务重连，开始诊断 Telescope X 插件问题。
Dependency installed with registry fallback.
Build completed.
Rebuild completed with path fix.
Final build with node command completed.
Absolute path fix build completed.
Final absolute path fix build completed.
Final path auto-resolution build completed.
Final resolution patch build completed.
Final attempt build completed.
Simplified path build completed.
Robust path resolution build completed.
