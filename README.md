# 宝可梦小手机论坛 - SillyTavern 原生扩展

基于原“测试论坛0.09 Android触摸修复版”移植，脱离 TavernHelper / JS-Slash-Runner，作为 SillyTavern 第三方 UI 扩展运行。

## 功能
- 洛托姆悬浮按钮
- 手机论坛界面与状态栏拖动
- 帖子、评论、楼中回复
- 玩家论坛昵称/简介
- 两个论坛的数据隔离
- 当前聊天独立论坛存档
- 帖子注入当前 SillyTavern AI 上下文
- 可选世界书上下文
- OpenAI-compatible API 生成帖子、评论和回复

## 安装
在 SillyTavern 的“安装扩展”中输入本仓库 Git URL。SillyTavern 会自动下载第三方扩展。

## 注意
Termux/Android 属于 SillyTavern 非官方支持的平台；扩展本身使用浏览器 DOM 和 SillyTavern 原生扩展 API，不依赖 TavernHelper。
