# 宝可梦小手机论坛（SillyTavern 扩展版 v0.41）

基于酒馆助手脚本 **测试论坛 0.331** 完整转换，**不依赖 Tavern Helper**。

## 安装

1. 将本文件夹放到：
   - `data/<用户名>/extensions/pkmn-phone-forum/`
   - 或 `public/scripts/extensions/third-party/pkmn-phone-forum/`
2. 确认目录内直接有 `manifest.json`、`index.js`、`style.css`
3. 刷新 SillyTavern，在扩展面板启用「宝可梦小手机论坛」
4. 右下角出现洛托姆手机按钮

## 功能

- 安全 / 成熟双论坛、发帖回复、NPC 互聊
- 正文读取 + 智能世界书筛选
- 独立 API 配置
- 按聊天独立存档（chatId + localStorage + chatMetadata）
- 帖子注入正文（setExtensionPrompt）

## 原生 API 映射

| 原酒馆助手 | 扩展实现 |
|-----------|---------|
| getChatMessages | context.chat |
| getWorldbookNames / getWorldbook | getWorldInfoNames / loadWorldInfo + API 兜底 |
| eventOn | eventSource.on |
| injectPrompts | setExtensionPrompt |
| updateChatMetadata / saveChat | context 同名 API |

## 版本

- 0.41.0：基于 0.331 干净重建，含世界书与切聊天存档修复
