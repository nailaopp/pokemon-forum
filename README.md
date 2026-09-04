# v0.13.13 修复版

- 洛托姆悬浮窗：单击打开，再单击关闭。
- 去除手机右上角独立 X。
- 缩放键移入状态栏右侧。
- 强化 Android WebView 触摸拖动。

# 宝可梦论坛纯白怪力（SillyTavern 扩展版 v0.41）

基于酒馆助手脚本 **测试论坛 0.331** 完整转换，**不依赖 Tavern Helper**。

## 安装

1. 将本文件夹放到：
   - `data/<用户名>/extensions/pkmn-phone-forum/`
   - 或 `public/scripts/extensions/third-party/pkmn-phone-forum/`
2. 确认目录内直接有 `manifest.json`、`index.js`、`style.css`
3. 刷新 SillyTavern，在扩展面板启用「宝可梦论坛纯白怪力」
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


## v0.50 修复
- 修复手机窗口初始定位：JS 使用 left/top 视口坐标时不再叠加 translate(-50%, -50%)。
- 恢复并固定洛托姆悬浮按钮的 fixed 定位、尺寸、层级与触摸拖动区域。
- 版本号更新为 0.50.0。


v0.55：彻底移除上一版洛托姆悬浮按钮拖动实现，重写为独立 drag session；Pointer Events + Android Touch Events 双路径，document/window 双兜底；超过6px才判定拖动，单击仍负责打开/关闭。


## v0.58 修复
- 通讯录设置新增「读取论坛全部内容」开关，默认开启并持久化。
- 「此聊天与论坛联动」改为联系人独立持久化，开关变更立即保存，重新进入联系人设置后保持状态。
- 新建联系人默认开启论坛联动。
- 升级迁移逻辑不再把用户主动关闭的论坛联动开关重新改回开启。
