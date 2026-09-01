# 宝可梦小手机论坛 - SillyTavern 原生扩展

这是基于“测试论坛0.01”版本重新制作的 SillyTavern 原生第三方扩展。

## 特点

- 不依赖 TavernHelper / 酒馆助手 / JS-Slash-Runner
- 使用 SillyTavern 原生 `SillyTavern.getContext()`
- 使用聊天级 `chatMetadata` + `saveMetadata()` 保存论坛数据
- 使用 SillyTavern 原生 `setExtensionPrompt()` 实现帖子注入正文
- 帖子、评论、楼中回复、玩家身份标记保留
- 两个论坛独立保存
- 两个论坛可设置不同昵称和简介
- 支持玩家发帖、评论、评论下回复
- 支持 AI 自动生成帖子、评论和楼中回复
- 保留手机界面、洛托姆悬浮图标和触摸拖动逻辑
- 保留 API、模型和世界书相关设置；世界书接口不可用时会安全降级
- 每个聊天使用独立论坛存档，不会主动把一个聊天的论坛内容写入另一个聊天

## 安装

在 SillyTavern 扩展管理器中选择通过 Git URL 安装，并输入：

`https://github.com/nailaopp/pokemon-forum`

## 仓库结构

```text
manifest.json
index.js
style.css
README.md
```

`manifest.json` 必须位于仓库根目录。

## 注意

本扩展直接使用 SillyTavern 原生上下文 API，因此不需要安装酒馆助手。


## 1.0.1
- 修复 Android/WebView 下 UI DOM 与扩展 CSS 文档不一致导致的不可见/不可点击问题。
- 增加 Touch Events 兜底，解决部分手机酒馆无法通过 Pointer Events 打开论坛的问题。
- 手机面板改为按视口自适应居中，避免小屏幕下整个面板位于可视区域之外。
