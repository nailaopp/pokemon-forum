# 宝可梦小手机论坛｜SillyTavern 原生扩展

基于酒馆助手版 0.21 转换。完全移除 TavernHelper 依赖。

1.0.2：严格按酒馆助手版 0.21 迁移；正文读取、当前选中的用户 Persona、世界书、聊天隔离、论坛注入、帖子/评论/回复、AI生成、双论坛昵称与设置等功能保持对应。明确不读取角色卡设定。

## 特性
- Android/Termux 触摸可打开论坛
- 顶部黑色状态栏与底部白色区域可拖动手机
- 半高/原高度切换
- 帖子、评论、楼中回复、AI生成
- 两个论坛独立昵称/简介
- 世界书通过 SillyTavern 原生 `/api/worldinfo/list` 与 `/api/worldinfo/get` 读取
- 帖子正文注入使用 SillyTavern 原生 `setExtensionPrompt`

## 安装
SillyTavern → 扩展 → 安装扩展 → Git URL：
`https://github.com/nailaopp/pokemon-forum`
