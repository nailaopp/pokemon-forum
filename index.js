(function () {
    'use strict';

    const NS = 'pkmn_phone_forum_v9';
    const LEGACY_NS = 'pkmn_phone_forum_v7';
    const LEGACY_NS_2 = 'pkmn_phone_forum_v5';
    const VERSION = 9;

    // Native SillyTavern extensions run in the main page context.
    // Do not redirect UI creation to window.top: on Android/WebView this can
    // put the DOM outside the document that receives the extension CSS/events.
    const topDoc = document;

    // ============================================================
    // 清理旧实例
    // ============================================================

    [
        'pkmn-float-btn',
        'pkmn-phone-panel',
        'pkmn-phone-style'
    ].forEach(id => {
        const el = topDoc.getElementById(id);
        if (el) el.remove();
    });

    // ============================================================
    // SillyTavern 原生 API 适配
    // ============================================================

    function getSTContext() {
        const st = window.SillyTavern || window.parent?.SillyTavern;
        if (!st || typeof st.getContext !== 'function') {
            throw new Error('未找到 SillyTavern 原生上下文');
        }
        return st.getContext();
    }

    const ST = {
        getChatMessages(start = 0) {
            const chat = getSTContext().chat;
            if (!Array.isArray(chat)) return [];
            if (typeof start === 'string' && /^-\d+$/.test(start)) {
                return chat.slice(Number(start));
            }
            return chat.slice(start);
        },

        getCharacterName() {
            const ctx = getSTContext();
            return ctx.name2 || ctx.character?.name || '';
        },

        getCurrentChatId() {
            const st = window.SillyTavern || window.parent?.SillyTavern;
            try {
                if (typeof st?.getCurrentChatId === 'function') return st.getCurrentChatId();
            } catch (_) {}
            return st?.getContext?.()?.chatId ?? '';
        },

        getWorldbookNames() {
            const ctx = getSTContext();
            if (typeof ctx.getWorldbookNames === 'function') return ctx.getWorldbookNames();
            const fn = window.getWorldbookNames || window.parent?.getWorldbookNames;
            return typeof fn === 'function' ? fn() : [];
        },

        getWorldbook(name) {
            const ctx = getSTContext();
            if (typeof ctx.getWorldbook === 'function') return ctx.getWorldbook(name);
            const fn = window.getWorldbook || window.parent?.getWorldbook;
            return typeof fn === 'function' ? fn(name) : [];
        },

        updateChatMetadata(values) {
            const ctx = getSTContext();
            if (!ctx.chatMetadata) return false;
            Object.assign(ctx.chatMetadata, values || {});
            return true;
        },

        async saveChat() {
            const ctx = getSTContext();
            if (typeof ctx.saveMetadata === 'function') return ctx.saveMetadata();
            if (typeof ctx.saveChat === 'function') return ctx.saveChat();
        },

        async setExtensionPrompt(id, content, enabled = true) {
            const ctx = getSTContext();
            if (typeof ctx.setExtensionPrompt !== 'function') {
                throw new Error('当前 SillyTavern 没有 setExtensionPrompt 接口');
            }
            if (enabled) {
                return ctx.setExtensionPrompt(id, content, 1, 0, false, 1);
            }
            return ctx.setExtensionPrompt(id, '', -1, 0, false, 1);
        },

        eventOn(eventName, handler) {
            const ctx = getSTContext();
            if (ctx.eventSource?.on) {
                ctx.eventSource.on(eventName, handler);
                return true;
            }
            const fn = window.eventOn || window.parent?.eventOn;
            if (typeof fn === 'function') {
                fn(eventName, handler);
                return true;
            }
            return false;
        },

        eventTypes() {
            const ctx = getSTContext();
            return ctx.eventTypes || window.tavern_events || {};
        }
    };

    // ============================================================
    // 默认论坛
    // ============================================================

    const SAFE_BOARDS = [

        {
            id: 'all',
            name: '全部话题',
            prompt:
                '汇总当前宝可梦论坛热点。内容应围绕宝可梦、训练家、对战、旅行、地区新闻与游戏世界。'
        },

        {
            id: 'battle',
            name: '战术交流中心',
            prompt:
                '讨论宝可梦对战、队伍构筑、招式、特性、道具、属性克制与实战经验。像真实玩家论坛一样说话。'
        },

        {
            id: 'breed',
            name: '宝可梦培育一条龙',
            prompt:
                '讨论宝可梦培育、孵蛋、性格、个体值、努力值、进化、亲密度、饲养和日常照顾。'
        },

        {
            id: 'world',
            name: '世界之大',
            prompt:
                '讨论宝可梦世界旅行、地区风景、城镇、训练家见闻、野外经历和各地区生活。'
        },

        {
            id: 'weird',
            name: '奇闻异事版',
            prompt:
                '讨论宝可梦世界里的离奇事件、都市传说、奇怪见闻、训练家遭遇和令人哭笑不得的故事。'
        },

        {
            id: 'news',
            name: '速报资讯',
            prompt:
                '发布宝可梦世界中的赛事、地区活动、官方公告、突发新闻与热点速报。'
        }
    ];

    const MATURE_BOARDS = [

        {
            id: 'm_all',
            name: '全部话题',
            prompt:
                '汇总成熟向宝可梦同人社区的热点，但不得生成露骨性行为、色情器官描写或动物性行为。可以讨论审美、暧昧、成人向同人创作的非露骨表达。'
        },

        {
            id: 'm_fanart',
            name: 'R-18同人创作',
            prompt:
                '讨论成人向同人创作的构图、画风、暧昧氛围、角色魅力与创作技巧，但不得生成露骨色情内容。'
        },

        {
            id: 'm_xp',
            name: 'XP交流协会',
            prompt:
                '讨论角色审美偏好、服装、气质、魅力点、角色关系和暧昧感，不描写露骨性行为。'
        },

        {
            id: 'm_male',
            name: '精英♂天堂',
            prompt:
                '以女性用户视角讨论男性角色的魅力、身材美学、气质、服装与暧昧幻想，不描写露骨色情内容。'
        },

        {
            id: 'm_female',
            name: '秘密花园♀',
            prompt:
                '以男性用户视角讨论女性角色的魅力、服装、美学、气质与暧昧幻想，不描写露骨色情内容。'
        },

        {
            id: 'm_pokemon',
            name: '禁忌の果实',
            prompt:
                '讨论宝可梦拟人化、设计美学、可爱或帅气的魅力、同人设定与暧昧创作，但不得生成或描述宝可梦性行为。'
        }
    ];

    // ============================================================
    // 默认配置
    // ============================================================

    const DEFAULT_CONFIG = {

        version: VERSION,

        api: {
            endpoint: '',
            key: '',
            model: '',
            autoDetect: true,
            models: []
        },

        readDepth: 12,

        // 世界书智能筛选：优先把与当前剧情相关的条目送给AI
        worldbookSmartFilter: true,
        worldbookMaxEntries: 36,
        worldbookMaxChars: 26000,

        worldbooks: [],

        refreshPosts: 3,

        userReplies: 3,

        npcTalks: 3,

        autoNpcTalk: true,

        userProfiles: {
            safe: { nickname: '旅行中的训练家', bio: '一名喜欢宝可梦、旅行和对战的普通训练家。' },
            mature: { nickname: '匿名用户', bio: '喜欢浏览同人创作与角色讨论。' }
        },

        safeBoards:
            SAFE_BOARDS.map(x => ({ ...x })),

        matureBoards:
            MATURE_BOARDS.map(x => ({ ...x }))
    };

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    function readGlobalConfig() {

        try {

            const raw =
                localStorage.getItem(NS + '_config') ||
                localStorage.getItem(LEGACY_NS + '_config');

            if (!raw) {
                return clone(DEFAULT_CONFIG);
            }

            const c =
                Object.assign(
                    clone(DEFAULT_CONFIG),
                    JSON.parse(raw)
                );

            c.api =
                Object.assign(
                    clone(DEFAULT_CONFIG.api),
                    c.api || {}
                );

            c.api.models =
                Array.isArray(c.api.models)
                    ? c.api.models
                    : [];

            c.userProfiles = Object.assign(
                clone(DEFAULT_CONFIG.userProfiles),
                c.userProfiles || {}
            );
            c.userProfiles.safe = Object.assign(
                clone(DEFAULT_CONFIG.userProfiles.safe),
                c.userProfiles.safe || {}
            );
            c.userProfiles.mature = Object.assign(
                clone(DEFAULT_CONFIG.userProfiles.mature),
                c.userProfiles.mature || {}
            );

            c.safeBoards =
                SAFE_BOARDS.map(d =>
                    Object.assign(
                        {},
                        d,
                        (
                            c.safeBoards || []
                        ).find(x => x.id === d.id) || {}
                    )
                );

            c.matureBoards =
                MATURE_BOARDS.map(d =>
                    Object.assign(
                        {},
                        d,
                        (
                            c.matureBoards || []
                        ).find(x => x.id === d.id) || {}
                    )
                );

            return c;

        } catch (_) {

            return clone(DEFAULT_CONFIG);

        }
    }

    let config = readGlobalConfig();

    function saveGlobalConfig() {

        localStorage.setItem(
            NS + '_config',
            JSON.stringify(config)
        );

    }

    // ============================================================
    // 当前聊天识别
    // ============================================================

    // ============================================================
    // 当前聊天稳定ID
    // ============================================================
    // 重点：不要从 chatMetadata 里的普通字段推断聊天ID。
    // 本论坛自己的 NS 数据也会写入 chatMetadata，切换聊天后
    // 如果继续读旧 metadata，很容易把旧论坛内容带到新聊天。
    // 优先使用 SillyTavern.getCurrentChatId()，它才是聊天文件的稳定ID。

    function getChatKey() {

        try {

            const st =
                window.SillyTavern ||
                window.parent?.SillyTavern;

            if (
                st &&
                typeof st.getCurrentChatId === 'function'
            ) {

                const id =
                    st.getCurrentChatId();

                if (id !== undefined && id !== null) {

                    return 'chat:' + String(id);

                }
            }

        } catch (_) {}

        // 某些版本可能直接把 getCurrentChatId 暴露为全局函数

        try {

            if (
                typeof getCurrentChatId === 'function'
            ) {

                const id =
                    getCurrentChatId();

                if (id !== undefined && id !== null) {

                    return 'chat:' + String(id);

                }
            }

        } catch (_) {}

        // 最后的兼容性降级：只有拿不到正式 chatId 时才使用内容指纹。
        try {

            const char =
                ST.getCharacterName
                    ? ST.getCharacterName()
                    : '';

            let first = '';

            if (ST.getChatMessages) {

                const a =
                    ST.getChatMessages(0);

                if (a && a[0]) {

                    first =
                        a[0].message ||
                        a[0].content ||
                        a[0].mes ||
                        '';
                }
            }

            if (!first) {

                const el =
                    topDoc.querySelector('.mes_text');

                if (el) {
                    first = el.innerText || '';
                }
            }

            return (
                'fallback:' +
                simpleHash(
                    String(char) +
                    '|' +
                    first
                )
            );

        } catch (_) {

            return 'fallback:unknown';

        }
    }

    function simpleHash(str) {

        let h = 2166136261;

        for (
            let i = 0;
            i < str.length;
            i++
        ) {

            h ^= str.charCodeAt(i);

            h =
                Math.imul(
                    h,
                    16777619
                );
        }

        return (
            h >>> 0
        ).toString(16);
    }

    // ============================================================
    // 聊天级论坛数据
    // ============================================================

    function makeChatState() {

        return {

            version: VERSION,

            chatKey: getChatKey(),

            safeThreads: [],

            matureThreads: [],

            counters: {},

            lastRefresh: {},

            updatedAt: Date.now()
        };
    }

    let chatState =
        makeChatState();

    function storageKey(key) {

        return (
            NS +
            '_chat_' +
            simpleHash(key)
        );
    }

    function loadChatState(key) {

        try {

            let raw =
                localStorage.getItem(
                    storageKey(key)
                );
            if (!raw) {
                const legacyKey = LEGACY_NS + '_chat_' + simpleHash(key);
                raw = localStorage.getItem(legacyKey);
            }
            if (!raw) {
                const legacyKey2 = LEGACY_NS_2 + '_chat_' + simpleHash(key);
                raw = localStorage.getItem(legacyKey2);
            }

            if (!raw) {
                return makeChatState();
            }

            const s =
                Object.assign(
                    makeChatState(),
                    JSON.parse(raw)
                );

            s.chatKey = key;

            s.safeThreads =
                Array.isArray(s.safeThreads)
                    ? s.safeThreads
                    : [];

            s.matureThreads =
                Array.isArray(s.matureThreads)
                    ? s.matureThreads
                    : [];

            s.counters =
                s.counters || {};

            s.lastRefresh =
                s.lastRefresh || {};

            return s;

        } catch (_) {

            return makeChatState();

        }
    }

    function saveChatState() {

        chatState.updatedAt =
            Date.now();

        localStorage.setItem(
            storageKey(chatState.chatKey),
            JSON.stringify(chatState)
        );

        try {
            ST.updateChatMetadata({ [NS]: clone(chatState) });
            Promise.resolve(ST.saveChat()).catch(() => {});
        } catch (_) {}
    }

    function loadFromChatMetadata(expectedKey = null) {

        try {

            const currentMetadata = getSTContext().chatMetadata;
            if (currentMetadata && currentMetadata[NS]) {

                const s =
                    currentMetadata[NS];

                if (
                    s &&
                    typeof s === 'object'
                ) {

                    const currentKey =
                        expectedKey ||
                        getChatKey();

                    // 防止 CHAT_CHANGED 的异步时序导致：
                    // 新聊天暂时还拿到旧 chatMetadata。
                    // 只有 metadata 里的 chatKey 与当前聊天ID一致时才恢复。
                    if (
                        s.chatKey &&
                        currentKey &&
                        s.chatKey !== currentKey
                    ) {
                        return false;
                    }

                    chatState =
                        Object.assign(
                            makeChatState(),
                            clone(s)
                        );

                    chatState.chatKey =
                        currentKey;

                    localStorage.setItem(
                        storageKey(
                            currentKey
                        ),
                        JSON.stringify(
                            chatState
                        )
                    );

                    return true;
                }
            }

        } catch (_) {}

        return false;
    }

    // ============================================================
    // 切换聊天：只读取新聊天，不在这里 saveChatState()
    // ============================================================
    // CHAT_CHANGED 触发时，酒馆当前 chatMetadata 已经可能指向“新聊天”。
    // 如果这里先 saveChatState()，就会把“旧聊天论坛”错误写进新聊天。
    // 所以旧聊天的数据只在论坛发生变化时保存；切换时只负责加载。

    function switchChat(forcedKey = null, silent = false) {

        const key =
            forcedKey ||
            getChatKey();

        if (
            !key ||
            key === 'fallback:unknown'
        ) {
            return;
        }

        if (
            key ===
            chatState.chatKey
        ) {
            renderForumList();
            return;
        }

        chatState =
            loadChatState(key);

        // 当前聊天自己的 metadata 是最高优先级。
        // 如果没有论坛数据，就保持刚刚创建的空状态。
        loadFromChatMetadata();

        // 确保最终状态一定属于当前 chatId。
        chatState.chatKey =
            key;

        renderForumList();

        if (!silent) {

            showToast(
                '已切换到当前聊天的论坛存档'
            );
        }
    }

    // 新建聊天时强制创建一份全新的论坛状态。
    // 不继承上一聊天的帖子。
    function resetForumForNewChat(newChatId = null) {

        const key =
            newChatId !== null &&
            newChatId !== undefined
                ? 'chat:' + String(newChatId)
                : getChatKey();

        chatState =
            makeChatState();

        chatState.chatKey =
            key;

        chatState.safeThreads = [];
        chatState.matureThreads = [];
        chatState.counters = {};
        chatState.lastRefresh = {};

        saveChatState();
        clearForumThreadInjection();

        currentThreadId =
            null;

        renderForumList();

        showToast(
            '新聊天：论坛已清空'
        );
    }

    // ============================================================
    // 正文读取
    // ============================================================

    function getMainChatText(depth) {

        depth =
            Math.max(
                1,
                Math.min(
                    100,
                    parseInt(depth) || 12
                )
            );

        let out = [];

        try {

            if (ST.getChatMessages) {

                const msgs =
                    ST.getChatMessages(
                        '-' + depth,
                        {
                            include_swipes: false
                        }
                    );

                if (Array.isArray(msgs)) {

                    msgs.forEach(m => {

                        const who =
                            m.name ||
                            (
                                m.role === 'user'
                                    ? '玩家'
                                    : '角色'
                            );

                        const text =
                            m.message ||
                            m.content ||
                            '';

                        if (text) {

                            out.push(
                                '【' +
                                who +
                                '】' +
                                text
                            );
                        }
                    });
                }
            }

        } catch (_) {}

        // DOM降级

        if (!out.length) {

            try {

                const els =
                    Array.from(
                        topDoc.querySelectorAll(
                            '.mes_text'
                        )
                    );

                els
                    .slice(-depth)
                    .forEach(el => {

                        if (el.innerText) {

                            out.push(
                                el.innerText
                            );
                        }
                    });

            } catch (_) {}
        }

        return out.join('\n');
    }

    // ============================================================
    // 世界书
    // ============================================================

    // ============================================================
    // 世界书智能读取
    // ============================================================

    function normalizeSearchText(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/[\s\u3000]+/g, ' ')
            .trim();
    }

    function extractContextKeywords(chat) {
        const text = normalizeSearchText(chat);
        if (!text) return [];

        // 中文世界书通常没有天然空格，因此同时保留：
        // 1) 连续中文片段
        // 2) 英文/数字/角色名片段
        // 3) 较长的词组
        const tokens = new Set();

        const cjk = text.match(/[\u3400-\u9fff]{2,12}/g) || [];
        cjk.forEach(x => {
            if (x.length >= 2) tokens.add(x);
            // 长片段拆成2~4字窗口，提升“人物名/地点名”命中率
            if (x.length >= 4) {
                for (let n = 2; n <= 4; n++) {
                    for (let i = 0; i + n <= x.length; i++) {
                        tokens.add(x.slice(i, i + n));
                    }
                }
            }
        });

        const latin = text.match(/[a-z0-9_\-]{2,30}/g) || [];
        latin.forEach(x => tokens.add(x));

        // 去掉极常见、信息量低的词
        const stop = new Set([
            '当前','正文','聊天','角色','玩家','说道','说道','然后','于是','一个','这个','那个',
            '自己','已经','还是','就是','因为','所以','但是','如果','什么','怎么','可以','没有',
            '进行','出现','看到','来到','今天','现在','刚刚','之后','他们','她们','我们','你们'
        ]);

        return [...tokens]
            .filter(x => x.length >= 2 && !stop.has(x))
            .slice(0, 180);
    }

    function worldbookEntryText(entry) {
        const keys = [
            entry?.name,
            entry?.comment,
            entry?.key,
            entry?.keys,
            entry?.keywords,
            entry?.secondary_keys,
            entry?.secondaryKeys,
            entry?.content
        ];

        return keys
            .flatMap(x => Array.isArray(x) ? x : [x])
            .filter(Boolean)
            .join(' ');
    }

    function scoreWorldbookEntry(entry, keywords) {
        const hay = normalizeSearchText(worldbookEntryText(entry));
        if (!hay) return 0;

        let score = 0;
        for (const kw of keywords) {
            if (!kw || kw.length < 2) continue;
            if (hay.includes(normalizeSearchText(kw))) {
                score += kw.length >= 4 ? 5 : 2;
            }
        }

        // 明确的世界书 key 命中额外加权
        const keyText = normalizeSearchText([
            entry?.key,
            entry?.keys,
            entry?.keywords,
            entry?.secondary_keys,
            entry?.secondaryKeys
        ].flat().filter(Boolean).join(' '));

        if (keyText && keywords.some(k => keyText.includes(normalizeSearchText(k)))) {
            score += 8;
        }

        return score;
    }

    async function getSelectedWorldbookEntries(chatText) {
        if (!config.worldbooks.length || !ST.getWorldbook) return [];

        const keywords = extractContextKeywords(chatText);
        const all = [];

        for (const name of config.worldbooks) {
            try {
                const entries = await ST.getWorldbook(name);
                if (!Array.isArray(entries)) continue;

                entries
                    .filter(e => e && e.enabled !== false && e.content)
                    .forEach((entry, index) => {
                        all.push({
                            book: name,
                            entry,
                            index,
                            score: scoreWorldbookEntry(entry, keywords)
                        });
                    });
            } catch (_) {}
        }

        // 没有关键词命中时，仍保留一小部分条目，避免世界书完全失效。
        all.sort((a, b) => b.score - a.score);

        const maxEntries = Math.max(1, Math.min(100, parseInt(config.worldbookMaxEntries) || 36));
        const maxChars = Math.max(4000, Math.min(45000, parseInt(config.worldbookMaxChars) || 26000));

        if (!config.worldbookSmartFilter) {
            return all.slice(0, maxEntries);
        }

        const positive = all.filter(x => x.score > 0);
        const fallback = all.filter(x => x.score === 0).slice(0, Math.min(8, maxEntries));
        const selected = [...positive, ...fallback].slice(0, maxEntries);

        // 字符预算，避免世界书把正文挤出去。
        const result = [];
        let used = 0;
        for (const item of selected) {
            const block = `[${item.entry.name || '条目'}]\n${item.entry.content}`;
            if (used + block.length > maxChars && result.length) continue;
            result.push(item);
            used += block.length;
            if (used >= maxChars) break;
        }

        return result;
    }

    async function getSelectedWorldbookText(chatText) {
        const selected = await getSelectedWorldbookEntries(chatText);
        if (!selected.length) return '';

        const byBook = new Map();
        selected.forEach(item => {
            if (!byBook.has(item.book)) byBook.set(item.book, []);
            byBook.get(item.book).push(item);
        });

        const pieces = [];
        for (const [book, items] of byBook.entries()) {
            pieces.push(`【世界书：${book}】`);
            items.forEach(item => {
                const relevance = item.score > 0 ? `相关度 ${item.score}` : '基础条目';
                pieces.push(`[${item.entry.name || '条目'} · ${relevance}]\n${item.entry.content}`);
            });
        }

        return pieces.join('\n');
    }

    function buildWorldStateRules() {
        return `
【上下文使用规则】
1. 当前正文是已经发生的剧情事实，优先级最高。
2. 世界书是世界观、人物、地点、组织、物品和背景设定；不得因为世界书内容而否定正文已经发生的事实。
3. 如果正文与世界书冲突，以正文为准；如果正文没有说明，再参考世界书。
4. 世界书没有提到的具体事件，不得伪装成已经发生过的事实。
5. 论坛可以进行合理的网友猜测、吐槽和讨论，但必须把“猜测”写成网友观点，而不是事实。
6. 不要把{{user}}直接写成论坛发帖人，除非任务明确要求处理玩家本人发帖。
`;
    }

    async function buildContext() {
        const chat = getMainChatText(config.readDepth);
        const world = await getSelectedWorldbookText(chat);

        let text = '';
        if (chat) {
            text += '【当前正文/聊天上下文 · 已发生事实】\n' + chat + '\n';
        }
        if (world) {
            text += '\n【与当前剧情相关的世界书】\n' + world + '\n';
        }

        text += '\n' + buildWorldStateRules();

        // 给正文保留更高优先级：正文最多20k，世界书最多26k，规则约2k。
        // 最终再做一次总预算保护。
        return text.slice(0, 48000);
    }

    // ============================================================
    // API
    // ============================================================

    function apiBase() {

        let x =
            (
                config.api.endpoint ||
                ''
            )
                .trim()
                .replace(/\/+$/, '');

        if (!x) {
            return '';
        }

        if (
            !/\/(v1|api)(\/|$)/.test(x)
        ) {

            x += '/v1';
        }

        return x;
    }

    function normalizeEndpointInput(value) {

        let x =
            String(value || '')
                .trim()
                .replace(/\/+$/, '');

        if (!x) {
            return '';
        }

        if (
            !/\/(v1|api)(\/|$)/.test(x)
        ) {

            x += '/v1';
        }

        return x;
    }

    function headers() {

        const h = {
            'Content-Type':
                'application/json'
        };

        if (config.api.key) {

            h.Authorization =
                'Bearer ' +
                config.api.key;
        }

        return h;
    }

    async function requestJSON(
        path,
        body,
        method = 'POST'
    ) {

        const base =
            apiBase();

        if (!base) {

            throw new Error(
                '未设置 API Endpoint'
            );
        }

        const res =
            await fetch(
                base + path,
                {
                    method,
                    headers: headers(),

                    body:
                        method === 'GET'
                            ? undefined
                            : JSON.stringify(body)
                }
            );

        if (!res.ok) {

            throw new Error(
                'HTTP ' +
                res.status
            );
        }

        return await res.json();
    }

    // ------------------------------------------------------------
    // 真正的连接检测
    // ------------------------------------------------------------

    async function testApiConnection(
        endpoint,
        key
    ) {

        const base =
            normalizeEndpointInput(
                endpoint
            );

        if (!base) {

            throw new Error(
                '未填写 Endpoint'
            );
        }

        const h = {
            'Content-Type':
                'application/json'
        };

        if (key) {

            h.Authorization =
                'Bearer ' +
                key;
        }

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
                15000
            );

        try {

            const res =
                await fetch(
                    base + '/models',
                    {
                        method: 'GET',
                        headers: h,
                        signal:
                            controller.signal
                    }
                );

            if (!res.ok) {

                throw new Error(
                    'HTTP ' +
                    res.status
                );
            }

            const data =
                await res.json();

            return {
                data,
                base
            };

        } finally {

            clearTimeout(timer);
        }
    }

    // ------------------------------------------------------------
    // 单独：检测连接
    // ------------------------------------------------------------

    async function detectConnection(
        silent = false
    ) {

        try {

            const endpoint =
                topDoc.getElementById(
                    'set-endpoint'
                )
                    ? topDoc.getElementById(
                        'set-endpoint'
                    ).value.trim()
                    : config.api.endpoint;

            const key =
                topDoc.getElementById(
                    'set-key'
                )
                    ? topDoc.getElementById(
                        'set-key'
                    ).value.trim()
                    : config.api.key;

            const result =
                await testApiConnection(
                    endpoint,
                    key
                );

            if (!silent) {

                showToast(
                    '✓ API连接成功'
                );
            }

            return result;

        } catch (e) {

            if (!silent) {

                showToast(
                    '✕ 连接失败：' +
                    (
                        e?.name === 'AbortError'
                            ? '请求超时'
                            : (
                                e?.message ||
                                e
                            )
                    )
                );
            }

            return null;
        }
    }

    // ------------------------------------------------------------
    // 单独：加载模型
    // ------------------------------------------------------------

    async function fetchModelsOnly(
        silent = false
    ) {

        try {

            const endpoint =
                topDoc.getElementById(
                    'set-endpoint'
                )
                    ? topDoc.getElementById(
                        'set-endpoint'
                    ).value.trim()
                    : config.api.endpoint;

            const key =
                topDoc.getElementById(
                    'set-key'
                )
                    ? topDoc.getElementById(
                        'set-key'
                    ).value.trim()
                    : config.api.key;

            const result =
                await testApiConnection(
                    endpoint,
                    key
                );

            const data =
                result.data;

            const raw =
                Array.isArray(data?.data)
                    ? data.data
                    : (
                        Array.isArray(data)
                            ? data
                            : []
                    );

            const models =
                raw
                    .map(
                        m =>
                            typeof m === 'string'
                                ? m
                                : (
                                    m?.id ||
                                    m?.name ||
                                    ''
                                )
                    )
                    .filter(Boolean);

            if (!models.length) {

                throw new Error(
                    '接口正常，但没有返回模型'
                );
            }

            config.api.endpoint =
                endpoint;

            config.api.key =
                key;

            config.api.models =
                models;

            if (
                !config.api.model ||
                !models.includes(
                    config.api.model
                )
            ) {

                config.api.model =
                    models[0];
            }

            saveGlobalConfig();

            if (!silent) {

                showToast(
                    '✓ 已加载 ' +
                    models.length +
                    ' 个模型'
                );
            }

            return models;

        } catch (e) {

            if (!silent) {

                showToast(
                    '✕ 加载模型失败：' +
                    (
                        e?.name === 'AbortError'
                            ? '请求超时'
                            : (
                                e?.message ||
                                e
                            )
                    )
                );
            }

            return [];
        }
    }

    // ------------------------------------------------------------
    // 兼容旧调用
    // ------------------------------------------------------------

    async function detectAndFetchModels(
        silent = false
    ) {

        const result =
            await detectConnection(
                silent
            );

        if (!result) {
            return false;
        }

        const models =
            await fetchModelsOnly(
                silent
            );

        return models.length > 0;
    }

    // ------------------------------------------------------------
    // AI调用
    // ------------------------------------------------------------

    async function callAI(
        messages,
        temperature = 0.9
    ) {

        if (!apiBase()) {

            throw new Error(
                '请先配置 API'
            );
        }

        if (!config.api.model) {

            await detectAndFetchModels(
                true
            );
        }

        if (!config.api.model) {

            throw new Error(
                '没有可用模型'
            );
        }

        const data =
            await requestJSON(
                '/chat/completions',
                {
                    model:
                        config.api.model,

                    messages,

                    temperature
                }
            );

        return (
            data?.choices?.[0]
                ?.message?.content ||
            ''
        );
    }

    // ============================================================
    // DOM / UI
    // ============================================================

    // 样式由扩展目录中的 style.css 提供。


    // ============================================================
    // 手机按钮
    // ============================================================

    const floatBtn =
        topDoc.createElement(
            'div'
        );

    floatBtn.id =
        'pkmn-float-btn';

    // 宝可梦风格洛托姆手机图标：重新设计为更明显的“洛托姆手机”造型。
    // 采用红橙机身、黑色描边、黄色闪电眼、白色屏幕，不依赖外部图片。
    floatBtn.innerHTML = `
<svg viewBox="0 0 96 96" aria-label="Rotom Phone" role="img">
  <defs>
    <linearGradient id="rotomPhoneBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff7050"/>
      <stop offset="0.55" stop-color="#f0443e"/>
      <stop offset="1" stop-color="#c92738"/>
    </linearGradient>
    <linearGradient id="rotomPhoneScreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e7f3f5"/>
    </linearGradient>
  </defs>
  <!-- 电火花耳朵/天线 -->
  <path d="M30 18L24 8l12 5 5-10 5 13" fill="none" stroke="#20242b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M66 18L72 8l-12 5-5-10-5 13" fill="none" stroke="#20242b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- 左右电翼 -->
  <path d="M19 39L7 31l4 14-8 9 16 1 8-10Z" fill="#f45143" stroke="#20242b" stroke-width="4" stroke-linejoin="round"/>
  <path d="M77 39l12-8-4 14 8 9-16 1-8-10Z" fill="#f45143" stroke="#20242b" stroke-width="4" stroke-linejoin="round"/>
  <!-- 洛托姆手机主体 -->
  <rect x="20" y="18" width="56" height="65" rx="15" fill="url(#rotomPhoneBody)" stroke="#20242b" stroke-width="4"/>
  <!-- 顶部扬声器 -->
  <rect x="39" y="23" width="18" height="4" rx="2" fill="#20242b" opacity=".85"/>
  <!-- 屏幕 -->
  <rect x="27" y="31" width="42" height="39" rx="10" fill="url(#rotomPhoneScreen)" stroke="#20242b" stroke-width="3"/>
  <!-- 洛托姆眼睛 -->
  <path d="M33 45l10-5 4 8-10 5Z" fill="#ffd72e" stroke="#20242b" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M63 45l-10-5-4 8 10 5Z" fill="#ffd72e" stroke="#20242b" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="40" cy="46" r="2" fill="#20242b"/>
  <circle cx="56" cy="46" r="2" fill="#20242b"/>
  <!-- 洛托姆笑脸 -->
  <path d="M38 57c6 7 14 7 20 0" fill="none" stroke="#20242b" stroke-width="3.5" stroke-linecap="round"/>
  <!-- 中央闪电 -->
  <path d="M51 31l-8 18h8l-5 12 14-20h-9l6-10Z" fill="#ffd72e" stroke="#20242b" stroke-width="3" stroke-linejoin="round"/>
  <!-- 底部Home键 -->
  <circle cx="48" cy="77" r="3.5" fill="#ffd72e" stroke="#20242b" stroke-width="2"/>
</svg>`;

    // ============================================================
    // 手机面板
    // ============================================================

    const panel =
        topDoc.createElement(
            'div'
        );

    panel.id =
        'pkmn-phone-panel';

    panel.innerHTML = `

<button id="pkmn-close-phone" type="button" aria-label="关闭">×</button>

<div class="pkmn-status">
    <span id="pkmn-time">00:00</span>
    <span>📶 🔋</span>
    <div class="pkmn-notch"></div>
</div>

<div class="pkmn-app">

    <!-- 首页 -->

    <div id="pkmn-home" class="pkmn-view">

        <div class="pkmn-home-apps">

            <div
                class="pkmn-app-icon"
                id="pkmn-open-safe"
            >
                <div>⚡</div>
                宝宝宝可萌大师
            </div>

            <div
                class="pkmn-app-icon"
                id="pkmn-open-mature"
            >
                <div>🌙</div>
                91宝可梦论坛
            </div>

            <div
                class="pkmn-app-icon"
                id="pkmn-open-settings"
            >
                <div>⚙️</div>
                设置
            </div>

        </div>

    </div>


    <!-- 论坛 -->

    <div id="pkmn-forum" class="pkmn-view">

        <div class="pkmn-head">

            <button id="pkmn-back-home">
                ‹
            </button>

            <span id="pkmn-forum-title">
                论坛
            </span>

            <button id="pkmn-refresh">
                ↻
            </button>

            <button id="pkmn-board-settings">
                ⚙
            </button>

        </div>

        <div
            class="pkmn-tabs"
            id="pkmn-tabs"
        ></div>

        <div
            class="pkmn-list"
            id="pkmn-thread-list"
        ></div>

        <div class="pkmn-bottom">

            <button
                class="pkmn-btn pkmn-primary"
                id="pkmn-generate"
            >
                ✨生成
            </button>

            <button
                class="pkmn-btn pkmn-secondary"
                id="pkmn-new-post"
            >
                📝发帖
            </button>

            <button
                class="pkmn-btn pkmn-secondary"
                id="pkmn-npc-talk"
            >
                💬互聊
            </button>

            <button
                class="pkmn-btn pkmn-danger"
                id="pkmn-clear"
            >
                清空
            </button>

        </div>

    </div>


    <!-- 帖子 -->

    <div
        id="pkmn-thread"
        class="pkmn-view"
    >

        <div class="pkmn-head">

            <button id="pkmn-back-forum">
                ‹
            </button>

            <span id="pkmn-thread-title">
                帖子
            </span>

        </div>

        <div
            class="pkmn-posts"
            id="pkmn-posts"
        ></div>

        <div class="pkmn-reply">
            <input id="pkmn-reply-input" placeholder="写评论...">
            <button id="pkmn-send" title="发送" aria-label="发送">发送</button>
        </div>

    </div>


    <!-- 玩家发帖弹窗 -->
    <div class="pkmn-modal" id="pkmn-post-modal">
        <div class="pkmn-modal-box">
            <div style="font-size:16px;font-weight:700;margin-bottom:10px">发表新帖</div>
            <div class="pkmn-small" id="pkmn-post-profile-hint"></div>
            <input class="pkmn-input" id="pkmn-post-title" maxlength="120" placeholder="帖子标题" style="margin-top:8px">
            <textarea class="pkmn-textarea" id="pkmn-post-content" maxlength="5000" placeholder="写下你想和论坛网友讨论的内容…" style="margin-top:8px;min-height:150px"></textarea>
            <div class="pkmn-row" style="margin-top:8px">
                <button class="pkmn-btn pkmn-secondary" id="pkmn-post-cancel">取消</button>
                <button class="pkmn-btn pkmn-primary" id="pkmn-post-submit">发表</button>
            </div>
        </div>
    </div>

    <!-- 设置 -->

    <div
        id="pkmn-settings"
        class="pkmn-view"
    >

        <div class="pkmn-head">

            <button id="pkmn-settings-back">
                ‹
            </button>

            <span>
                论坛设置
            </span>

        </div>

        <div
            class="pkmn-settings"
            id="pkmn-settings-body"
        ></div>

    </div>

</div>

<div class="pkmn-footer">
    <div
        class="pkmn-homebar"
        id="pkmn-homebar"
    ></div>
</div>

`;

    topDoc.body.appendChild(
        floatBtn
    );

    topDoc.body.appendChild(
        panel
    );

    // ============================================================
    // DOM快捷方式
    // ============================================================

    const $ =
        id =>
            topDoc.getElementById(id);

    const home =
        $('pkmn-home');

    const forum =
        $('pkmn-forum');

    const thread =
        $('pkmn-thread');

    const settings =
        $('pkmn-settings');

    const threadList =
        $('pkmn-thread-list');

    const tabs =
        $('pkmn-tabs');

    // ============================================================
    // Toast
    // ============================================================

    const toast =
        (() => {

            const x =
                topDoc.createElement(
                    'div'
                );

            x.style.cssText =
                'position:fixed;' +
                'left:50%;' +
                'top:55px;' +
                'transform:translateX(-50%);' +
                'z-index:1000000000;' +
                'background:rgba(0,0,0,.8);' +
                'color:#fff;' +
                'padding:9px 15px;' +
                'border-radius:18px;' +
                'font-size:12px;' +
                'opacity:0;' +
                'transition:.2s;' +
                'pointer-events:none';

            topDoc.body.appendChild(
                x
            );

            return x;

        })();

    function showToast(s) {

        toast.textContent =
            s;

        toast.style.opacity =
            '1';

        clearTimeout(
            showToast.t
        );

        showToast.t =
            setTimeout(
                () =>
                    toast.style.opacity =
                        '0',
                2200
            );
    }

    // ============================================================
    // 当前状态
    // ============================================================

    let currentForum =
        'safe';

    let currentBoard =
        'all';

    let currentThreadId =
        null;

    // 当前注入到酒馆正文的论坛帖子。只作用于后续AI生成，不修改聊天原文。
    let injectedThreadId = null;

    let generating =
        false;

    // ============================================================
    // 板块 / 帖子辅助
    // ============================================================

    function currentUserProfile() {
        const key = currentForum === 'safe' ? 'safe' : 'mature';
        return config.userProfiles[key] || { nickname: '匿名用户', bio: '' };
    }

    function boards() {

        return currentForum === 'safe'
            ? config.safeBoards
            : config.matureBoards;
    }

    function threads() {

        return currentForum === 'safe'
            ? chatState.safeThreads
            : chatState.matureThreads;
    }

    function setThreads(a) {

        if (
            currentForum ===
            'safe'
        ) {

            chatState.safeThreads =
                a;

        } else {

            chatState.matureThreads =
                a;
        }
    }

    function boardDef(id) {

        return (
            boards().find(
                x => x.id === id
            ) ||
            boards()[0]
        );
    }

    // ============================================================
    // 页面切换
    // ============================================================

    function openView(which) {

        home.style.transform =
            which === 'home'
                ? 'translateX(0)'
                : 'translateX(-100%)';

        forum.style.transform =
            which === 'forum'
                ? 'translateX(0)'
                : 'translateX(100%)';

        thread.style.transform =
            which === 'thread'
                ? 'translateX(0)'
                : 'translateX(100%)';

        settings.style.transform =
            which === 'settings'
                ? 'translateX(0)'
                : 'translateX(100%)';
    }

    // ============================================================
    // 板块标签
    // ============================================================

    function renderTabs() {

        tabs.innerHTML =
            '';

        boards().forEach(
            b => {

                const d =
                    topDoc.createElement(
                        'div'
                    );

                d.className =
                    'pkmn-tab' +
                    (
                        b.id === currentBoard
                            ? ' active'
                            : ''
                    );

                d.textContent =
                    b.name;

                d.onclick =
                    () => {

                        currentBoard =
                            b.id;

                        renderTabs();

                        renderForumList();
                    };

                tabs.appendChild(
                    d
                );
            }
        );

        $('pkmn-forum-title')
            .textContent =
                currentForum === 'safe'
                    ? '宝宝宝可萌大师'
                    : '91宝可梦论坛';
    }

    // ============================================================
    // HTML转义
    // ============================================================

    function esc(s) {

        return String(
            s ?? ''
        ).replace(
            /[&<>"']/g,
            m =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                })[m]
        );
    }

    // ============================================================
    // 论坛列表
    // ============================================================

    // ============================================================
    // 论坛帖子 -> 酒馆正文提示词注入
    // ============================================================

    const FORUM_INJECT_PROMPT_ID = 'pkmn-forum-thread-injection';

    function getThreadInjectionText(t) {
        if (!t) return '';

        const profile = currentUserProfile();
        const forumNick = profile.nickname || '匿名用户';
        const lines = [
            '【论坛帖子注入】',
            '以下内容作为【论坛正文资料】注入当前酒馆正文上下文，仅供当前回复参考；它不是聊天历史原文，也不要把它伪装成已经发生在正文里的剧情。',
            `论坛：${currentForum === 'safe' ? '宝宝宝可萌大师' : '91宝可梦论坛'}`,
            `板块：${boardDef(t.board)?.name || t.board || '未知板块'}`,
            `当前聊天主角的论坛昵称：${forumNick}`,
            `当前聊天主角的论坛简介：${profile.bio || '未设置'}`,
            '',
            '【非常重要的身份规则】',
            '1. 标记为【主角本人】的帖子、评论、楼中回复，全部视为当前聊天主角自己发送的内容。',
            '2. 标记为【论坛网友】的内容才是其他网友。',
            '3. 主角知道自己的论坛昵称、帖子和评论，不要把自己的内容误认为陌生网友。',
            '4. 论坛内容只是当前剧情的参考资料，不得凭空把论坛讨论当成现实中已经发生的剧情事实。',
            '',
            `【帖子】${t.title || '无标题'}`,
            `楼主：${t.author || '匿名用户'}`
        ];

        (Array.isArray(t.posts) ? t.posts : []).forEach((p, i) => {
            const isMainCharacter = Boolean(p.isUser || (i === 0 && t.isUserThread));
            const tag = isMainCharacter ? '【主角本人】' : '【论坛网友】';
            const bio = p.authorBio ? `（简介：${p.authorBio}）` : '';
            lines.push(`${i + 1}楼 ${tag} ${p.author || '匿名用户'}${bio}：${p.content || ''}`);
            const nested = Array.isArray(p.replies) ? p.replies : [];
            nested.forEach((r, ri) => {
                const rTag = r.isUser ? '【主角本人】' : '【论坛网友】';
                const rBio = r.authorBio ? `（简介：${r.authorBio}）` : '';
                lines.push(`  └ 回复${ri + 1} ${rTag} ${r.author || '匿名用户'}${rBio}：${r.content || ''}`);
            });
        });

        lines.push('', '请把上述身份标记视为事实。主角能够认出自己的论坛昵称、自己的帖子以及自己发出的评论。', '【论坛帖子注入结束】');
        return lines.join('\n');
    }

    async function setForumThreadInjection(t) {
        try {
            if (!t) {
                await ST.setExtensionPrompt(FORUM_INJECT_PROMPT_ID, '', false);
                injectedThreadId = null;
                return true;
            }

            const content = getThreadInjectionText(t);
            await ST.setExtensionPrompt(FORUM_INJECT_PROMPT_ID, content, true);
            injectedThreadId = t.id;
            return true;
        } catch (e) {
            showToast('注入失败：' + (e?.message || e));
            return false;
        }
    }

    async function toggleForumThreadInjection(t) {
        if (!t) return;
        if (injectedThreadId === t.id) {
            const ok = await setForumThreadInjection(null);
            if (ok) {
                renderForumList();
                if (currentThreadId === t.id) openThread(t.id);
                showToast('已取消注入');
            }
            return;
        }
        const ok = await setForumThreadInjection(t);
        if (ok) {
            renderForumList();
            if (currentThreadId === t.id) openThread(t.id);
            showToast('已将本帖注入正文');
        }
    }

    function clearForumThreadInjection() {
        ST.setExtensionPrompt(FORUM_INJECT_PROMPT_ID, '', false).catch?.(() => {});
        injectedThreadId = null;
    }

    function renderForumList() {

        renderTabs();

        const arr =
            threads().filter(
                t =>
                    t.board ===
                    currentBoard
            );

        threadList.innerHTML =
            '';

        arr
            .slice()
            .reverse()
            .forEach(
                t => {

                    const d =
                        topDoc.createElement(
                            'div'
                        );

                    d.className =
                        'pkmn-thread-card';

                    const firstPost = Array.isArray(t.posts) && t.posts[0] ? t.posts[0] : null;
                    const avatarName = String(t.author || '匿名用户').trim().slice(0, 1) || '匿';
                    const snippet = firstPost?.content || '';
                    const commentCount = Math.max(0, (t.posts?.length || 1) - 1);
                    const nestedCount = (t.posts || []).slice(1).reduce(
                        (sum, p) => sum + ensureNestedReplies(p).length,
                        0
                    );

                    d.innerHTML =
                        `
<div class="pkmn-thread-avatar">${esc(avatarName)}</div>
<div class="pkmn-thread-body">
    <div class="pkmn-thread-user">${esc(t.author || '匿名用户')}</div>
    <div class="pkmn-thread-title">${esc(t.title || '无标题')}</div>
    <div class="pkmn-thread-snippet">${esc(snippet)}</div>
    <div class="pkmn-thread-footer">
        <span class="pkmn-thread-stat">评论 ${commentCount + nestedCount}</span>
        <span class="pkmn-thread-time">${esc(t.time || '刚刚')}</span>
    </div>
</div>

<button class="pkmn-inject" title="将本帖注入正文（实际仍为提示词注入）">
    ${injectedThreadId === t.id ? '✓ 已注入' : '注入正文'}
</button>

<button class="pkmn-del" title="删除帖子">✕</button>
`;

                    d.onclick =
                        e => {

                            if (
                                e.target
                                    .classList
                                    .contains(
                                        'pkmn-del'
                                    )
                            ) {
                                return;
                            }

                            openThread(
                                t.id
                            );
                        };

                    const injectBtn = d.querySelector('.pkmn-inject');
                    if (injectBtn) {
                        injectBtn.onclick = async e => {
                            e.stopPropagation();
                            await toggleForumThreadInjection(t);
                        };
                    }

                    d.querySelector(
                        '.pkmn-del'
                    ).onclick =
                        e => {

                            e.stopPropagation();

                            if (
                                confirm(
                                    '删除这条帖子？'
                                )
                            ) {

                                setThreads(
                                    threads()
                                        .filter(
                                            x =>
                                                x.id !==
                                                t.id
                                        )
                                );

                                saveChatState();

                                renderForumList();
                            }
                        };

                    threadList.appendChild(
                        d
                    );
                }
            );

        if (!arr.length) {

            threadList.innerHTML =
                `
<div style="
padding:40px;
text-align:center;
color:#aaa;
font-size:12px
">
本板块暂无帖子
<br>
点击“刷新/生成”开始
</div>
`;
        }
    }

    // ============================================================
    // 打开帖子
    // ============================================================

    function ensureNestedReplies(post) {
        if (!post) return [];
        if (!Array.isArray(post.replies)) post.replies = [];
        return post.replies;
    }

    function openNestedComposer(rootIndex) {
        const box = $('pkmn-posts');
        if (!box) return;
        box.querySelectorAll('.pkmn-nested-composer.show').forEach(el => {
            if (el.dataset.rootIndex !== String(rootIndex)) {
                el.classList.remove('show');
            }
        });
        const composer = box.querySelector(
            `.pkmn-nested-composer[data-root-index="${rootIndex}"]`
        );
        if (!composer) return;
        composer.classList.toggle('show');
        if (composer.classList.contains('show')) {
            const input = composer.querySelector('.pkmn-nested-input');
            setTimeout(() => input?.focus(), 30);
        }
    }

    async function submitNestedReply(rootIndex) {
        const t = threads().find(x => x.id === currentThreadId);
        if (!t || !t.posts[rootIndex]) return;

        const rootPost = t.posts[rootIndex];
        if (rootIndex === 0) {
            showToast('楼主正文请使用底部评论框回复');
            return;
        }

        const composer = $('pkmn-posts')?.querySelector(
            `.pkmn-nested-composer[data-root-index="${rootIndex}"]`
        );
        const input = composer?.querySelector('.pkmn-nested-input');
        const text = input?.value.trim();
        if (!text) return;

        const profile = currentUserProfile();
        const replies = ensureNestedReplies(rootPost);

        replies.push({
            author: profile.nickname,
            authorBio: profile.bio,
            isUser: true,
            content: text,
            time: '刚刚'
        });

        input.value = '';
        composer.classList.remove('show');
        saveChatState();
        openThread(t.id);

        const n = Math.max(0, Math.min(20, parseInt(config.userReplies) || 0));
        if (n > 0) {
            showToast('正在生成评论下的回复…');
            await generateNestedReplies(t, rootPost, text, n);
            openThread(t.id);
        }
    }

    async function generateNestedReplies(targetThread, rootPost, targetContent, count) {
        if (!targetThread || !rootPost || count <= 0) return 0;

        try {
            const ctx = await buildContext();
            const parentAuthor = rootPost.author || '匿名网友';
            const nestedHistory = ensureNestedReplies(rootPost)
                .slice(-12)
                .map((p, i) => `${i + 1}层回复 ${p.author}：${p.content}`)
                .join('\n');

            const matureRule =
                currentForum === 'mature'
                    ? '成熟向内容仍必须保持非露骨，不得生成色情行为或性器官描写。'
                    : '';

            const userProfile = currentUserProfile();
            const prompt = `
你是宝可梦论坛里的匿名网友群体。

【主角论坛身份】
论坛昵称：${userProfile.nickname || '匿名用户'}
论坛简介：${userProfile.bio || '未设置'}
凡是标记为【主角本人】的内容，都代表当前聊天主角自己发送的内容。其他内容才是论坛网友。
不要冒充主角。

【当前帖子】
《${targetThread.title}》

【正在回复的评论】
评论作者：${parentAuthor}
评论内容：
${rootPost.content}

【这个评论下面已有的回复】
${nestedHistory || '暂无'}

【刚刚收到的新回复】
${targetContent}

${boardPrompt()}

${matureRule}

请生成 ${count} 条不同网友对“刚刚收到的新回复”的自然回应。
这些回应都属于“正在回复的评论”下面的楼中回复，不要创建新的顶层评论；如果评论主人参与回复，也仍然继续归入这条评论的楼中回复区域。
不同网友要有不同性格、关注点和语气。

返回JSON数组：
[
    {
        "author":"匿名昵称",
        "content":"回复"
    }
]
`;

            const raw = await callAI(
                [
                    { role: 'system', content: prompt },
                    { role: 'user', content: '生成评论下的楼中回复。' }
                ],
                0.9
            );

            let arr = parseJSON(raw);
            if (!Array.isArray(arr)) arr = arr ? [arr] : [];

            arr = arr
                .slice(0, count)
                .filter(x => x && x.author && x.content);

            const replies = ensureNestedReplies(rootPost);
            arr.forEach(x => {
                replies.push({
                    author: x.author,
                    content: x.content,
                    time: '刚刚'
                });
            });

            saveChatState();
            if (currentThreadId === targetThread.id) {
                openThread(targetThread.id);
            }
            return arr.length;
        } catch (e) {
            showToast('楼中回复生成失败：' + (e?.message || e));
            return 0;
        }
    }

    function renderNestedReplies(rootPost, rootIndex) {
        const nested = ensureNestedReplies(rootPost);
        if (!nested.length) return '';

        return `
<div class="pkmn-nested-replies" data-root-index="${rootIndex}">
${nested.map((r) => {
    const isUser = !!r.isUser;
    const name = String(r.author || '匿名网友');
    return `
<div class="pkmn-nested-msg${isUser ? ' is-user' : ''}">
    <div class="pkmn-nested-main">
        <div class="pkmn-nested-bubble">
            <span class="pkmn-nested-name">${esc(name)}</span><span class="pkmn-nested-text">${esc(r.content || '')}</span>
        </div>
    </div>
</div>`;
}).join('')}
</div>`;
    }

    function renderCommentReplyComposer(rootIndex) {
        return `
<div class="pkmn-nested-composer" data-root-index="${rootIndex}">
    <input class="pkmn-nested-input" placeholder="回复这条评论...">
    <button class="pkmn-nested-send" type="button">发送</button>
</div>`;
    }

    function openThread(id) {

        const t = threads().find(x => x.id === id);
        if (!t) return;

        currentThreadId = id;

        $('pkmn-thread-title').textContent = t.title;

        const box = $('pkmn-posts');
        box.innerHTML = '';

        const injectBar = topDoc.createElement('div');
        injectBar.className = 'pkmn-inject-bar';
        const injectThreadBtn = topDoc.createElement('button');
        injectThreadBtn.className = 'pkmn-thread-inject-btn' + (injectedThreadId === t.id ? ' active' : '');
        injectThreadBtn.textContent =
            injectedThreadId === t.id
                ? '✓ 已注入正文 · 点击取消'
                : '📥 注入正文';
        injectThreadBtn.onclick = async e => {
            e.preventDefault();
            e.stopPropagation();
            await toggleForumThreadInjection(t);
        };
        injectBar.appendChild(injectThreadBtn);
        box.appendChild(injectBar);

        // 楼主保留大块微博正文样式。
        const first = t.posts[0];
        if (first) {
            const d = topDoc.createElement('div');
            d.className = 'pkmn-post';
            const mainAvatar = String(first.author || '匿名用户').trim().slice(0, 1) || '匿';
            const mainComments = Math.max(0, (t.posts?.length || 1) - 1);
            const mainNested = (t.posts || []).slice(1).reduce(
                (sum, p) => sum + ensureNestedReplies(p).length,
                0
            );
            d.innerHTML = `
<div class="pkmn-post-head">
    <div class="pkmn-post-avatar">${esc(mainAvatar)}</div>
    <div class="pkmn-post-user">
        <div class="pkmn-post-author">${esc(first.author || '匿名用户')}</div>
        <div class="pkmn-post-time">${esc(t.time || '刚刚')} · ${t.isUserThread ? '我的帖子' : '论坛网友'}</div>
    </div>
</div>
<div class="pkmn-post-floor">1楼</div>
<div class="pkmn-post-title">${esc(t.title || '无标题')}</div>
<div class="pkmn-content">${esc(first.content || '')}</div>
<div class="pkmn-post-tools">
    <span class="pkmn-post-tool">↗ 转发</span>
    <span class="pkmn-post-tool">💬 ${mainComments + mainNested}</span>
    <span class="pkmn-post-tool">♡ 赞</span>
</div>
`;
            box.appendChild(d);
        }

        const topLevel = t.posts.slice(1);
        const totalNested = topLevel.reduce(
            (sum, p) => sum + ensureNestedReplies(p).length,
            0
        );

        if (topLevel.length || totalNested) {
            const title = topDoc.createElement('div');
            title.className = 'pkmn-replies-title';
            title.textContent = `评论 ${topLevel.length + totalNested}`;
            box.appendChild(title);

            const divider = topDoc.createElement('div');
            divider.className = 'pkmn-thread-divider';
            box.appendChild(divider);

            topLevel.forEach((p, index) => {
                const rootIndex = index + 1;
                const d = topDoc.createElement('div');
                const isUser = !!p.isUser;
                d.className = 'pkmn-reply-msg' + (isUser ? ' is-user' : '');

                const name = String(p.author || '匿名网友');
                const avatar = name.trim().slice(0, 1) || '匿';

                d.innerHTML = `
<div class="pkmn-reply-avatar">${esc(avatar)}</div>
<div class="pkmn-reply-main">
    <div class="pkmn-reply-name">
        ${esc(name)}
        ${isUser ? '<span style="margin-left:4px;color:#55a348">· 我</span>' : ''}
    </div>
    <div class="pkmn-reply-bubble">${esc(p.content)}</div>
    <div class="pkmn-reply-meta">${rootIndex + 1}楼${p.time ? ' · ' + esc(p.time) : ''}</div>
    <div class="pkmn-comment-actions">
        <button class="pkmn-comment-reply-btn" type="button" data-reply-root="${rootIndex}">回复</button>
    </div>
    ${renderNestedReplies(p, rootIndex)}
    ${renderCommentReplyComposer(rootIndex)}
</div>
`;
                box.appendChild(d);
            });
        }

        // 评论区使用事件委托，避免每次重新渲染后按钮失效。
        box.querySelectorAll('[data-reply-root]').forEach(btn => {
            btn.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                openNestedComposer(Number(btn.dataset.replyRoot));
            };
        });

        box.querySelectorAll('.pkmn-nested-send').forEach(btn => {
            btn.onclick = async e => {
                e.preventDefault();
                e.stopPropagation();
                await submitNestedReply(Number(btn.closest('.pkmn-nested-composer')?.dataset.rootIndex));
            };
        });

        box.querySelectorAll('.pkmn-nested-input').forEach(input => {
            input.onkeydown = async e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const root = Number(input.closest('.pkmn-nested-composer')?.dataset.rootIndex);
                    await submitNestedReply(root);
                }
            };
        });

        box.scrollTop = box.scrollHeight;
        openView('thread');
    }

    // ============================================================
    // ID
    // ============================================================

    function makeId() {

        return (
            't' +
            Date.now() +
            Math.floor(
                Math.random() *
                100000
            )
        );
    }

    // ============================================================
    // JSON解析
    // ============================================================

    function parseJSON(text) {

        let s =
            String(
                text || ''
            )
                .trim()
                .replace(
                    /^```json/i,
                    ''
                )
                .replace(
                    /^```/,
                    ''
                )
                .replace(
                    /```$/,
                    ''
                )
                .trim();

        try {

            return JSON.parse(
                s
            );

        } catch (_) {}

        const a =
            s.indexOf('{');

        const b =
            s.lastIndexOf('}');

        if (
            a >= 0 &&
            b > a
        ) {

            try {

                return JSON.parse(
                    s.slice(
                        a,
                        b + 1
                    )
                );

            } catch (_) {}
        }

        const aa =
            s.indexOf('[');

        const bb =
            s.lastIndexOf(']');

        if (
            aa >= 0 &&
            bb > aa
        ) {

            try {

                return JSON.parse(
                    s.slice(
                        aa,
                        bb + 1
                    )
                );

            } catch (_) {}
        }

        return null;
    }

    // ============================================================
    // 当前板块提示词
    // ============================================================

    function boardPrompt() {

        const b =
            boardDef(
                currentBoard
            );

        return b
            ? b.prompt
            : '';
    }

    // ============================================================
    // 生成帖子
    // ============================================================

    async function generatePosts(
        count,
        boardId = currentBoard,
        silent = false
    ) {

        if (generating) {
            return 0;
        }

        generating =
            true;

        try {

            const ctx =
                await buildContext();

            const b =
                boards().find(
                    x =>
                        x.id ===
                        boardId
                ) ||
                boardDef(
                    boardId
                );

            const forumName =
                currentForum === 'safe'
                    ? '宝宝宝可萌大师'
                    : '91宝可梦论坛';

            const matureRule =
                currentForum === 'mature'
                    ? `
这是成熟向同人社区：
允许暧昧、成人审美和非露骨讨论，
但禁止露骨色情、性行为描写、
色情器官描写以及宝可梦性行为。
`
                    : '';

            const prompt =
                `
你是“${forumName}”的匿名论坛用户。

板块：
${b.name}

板块定位：
${b.prompt}

论坛风格：
网络化、口语化、不同用户有不同性格；
可以有吐槽、争论、玩梗、夸张表达和emoji，
但不要说教。

${matureRule}

严格根据当前正文和世界书内容，
不要凭空改变已经发生的世界线。

一次生成 ${count} 条互不重复的新帖子。

每条包含：
title
author
content

author必须是与{{user}}无关的匿名网络昵称。

只返回JSON数组，不要解释。

格式：

[
    {
        "title":"...",
        "author":"...",
        "content":"..."
    }
]

${ctx}
`;

            const raw =
                await callAI(
                    [
                        {
                            role:
                                'system',
                            content:
                                prompt
                        },

                        {
                            role:
                                'user',
                            content:
                                '生成帖子。'
                        }
                    ],
                    0.95
                );

            let arr =
                parseJSON(
                    raw
                );

            if (!Array.isArray(arr)) {

                arr =
                    arr
                        ? [arr]
                        : [];
            }

            arr =
                arr
                    .slice(
                        0,
                        count
                    )
                    .filter(
                        x =>
                            x &&
                            x.title &&
                            x.author &&
                            x.content
                    );

            const target =
                threads();

            arr.forEach(
                x => {

                    target.push(
                        {
                            id:
                                makeId(),

                            board:
                                boardId,

                            title:
                                x.title,

                            author:
                                x.author,

                            time:
                                '刚刚',

                            posts:
                                [
                                    {
                                        author:
                                            x.author,

                                        content:
                                            x.content
                                    }
                                ]
                        }
                    );
                }
            );

            setThreads(
                target
            );

            saveChatState();

            renderForumList();

            if (!silent) {

                showToast(
                    '已生成 ' +
                    arr.length +
                    ' 条新帖子'
                );
            }

            return arr.length;

        } catch (e) {

            if (!silent) {

                showToast(
                    '生成失败：' +
                    e.message
                );
            }

            return 0;

        } finally {

            generating =
                false;
        }
    }

    // ============================================================
    // 生成对应回复
    // ============================================================

    async function generateReplies(
        targetThread,
        targetContent,
        count,
        reason = '玩家回复'
    ) {

        if (
            !targetThread ||
            count <= 0
        ) {

            return 0;
        }

        try {

            const ctx =
                await buildContext();

            const history =
                targetThread
                    .posts
                    .slice(-12)
                    .map(
                        (p, i) =>
                            `${i + 1}楼 ${p.author}：${p.content}`
                    )
                    .join('\n');

            const matureRule =
                currentForum === 'mature'
                    ? '成熟向内容仍必须保持非露骨，不得生成色情行为或性器官描写。'
                    : '';

            const userProfile = currentUserProfile();
            const prompt =
                `
你是宝可梦论坛的匿名网友群体。

【主角论坛身份】
论坛昵称：${userProfile.nickname || '匿名用户'}
论坛简介：${userProfile.bio || '未设置'}
凡是标记为【主角本人】的楼层，都代表当前聊天主角自己发送的内容。其他楼层才是论坛网友。生成回复时不要冒充主角，也不要把主角已经说过的话再次当成网友发言。

${boardPrompt()}

${matureRule}

帖子标题：
《${targetThread.title}》

最近楼层：

${history}

触发内容：

${targetContent}

请生成 ${count} 条不同网友的直接回应。

优先回应触发内容。

每条都要有不同性格、
不同关注点和不同语气。

禁止把所有人写成同一种说话方式。

返回JSON数组：

[
    {
        "author":"匿名昵称",
        "content":"回复"
    }
]
`;

            const raw =
                await callAI(
                    [
                        {
                            role:
                                'system',
                            content:
                                prompt
                        },

                        {
                            role:
                                'user',
                            content:
                                '生成对应回复。'
                        }
                    ],
                    0.9
                );

            let arr =
                parseJSON(
                    raw
                );

            if (!Array.isArray(arr)) {

                arr =
                    arr
                        ? [arr]
                        : [];
            }

            arr =
                arr
                    .slice(
                        0,
                        count
                    )
                    .filter(
                        x =>
                            x &&
                            x.author &&
                            x.content
                    );

            arr.forEach(
                x => {

                    targetThread.posts.push(
                        {
                            author:
                                x.author,

                            content:
                                x.content
                        }
                    );
                }
            );

            saveChatState();

            if (
                currentThreadId ===
                targetThread.id
            ) {

                openThread(
                    targetThread.id
                );
            }

            return arr.length;

        } catch (e) {

            showToast(
                '回复生成失败：' +
                e.message
            );

            return 0;
        }
    }

    // ============================================================
    // NPC互聊
    // ============================================================

    async function npcTalk(
        count
    ) {

        const target =
            threads().filter(
                t =>
                    t.board ===
                    currentBoard
            );

        if (!target.length) {

            showToast(
                '当前板块没有帖子'
            );

            return;
        }

        const pool =
            target.slice(
                -Math.max(
                    3,
                    count
                )
            );

        try {

            const ctx =
                await buildContext();

            const history =
                pool
                    .map(
                        t =>
                            `
帖子：《${t.title}》

${t.posts
    .slice(-3)
    .map(
        p =>
            p.author +
            '：' +
            p.content
    )
    .join('\n')}
`
                    )
                    .join('\n\n');

            const prompt =
                `
你是宝可梦匿名论坛。

${boardPrompt()}

让 ${count} 组NPC之间互相讨论已有帖子。

他们不是玩家。

不要冒充{{user}}。

每组可以围绕不同帖子。

人物性格必须不同。

${
    currentForum === 'mature'
        ? '成熟向内容保持非露骨。'
        : ''
}

返回JSON数组：

[
    {
        "threadTitle":"已有帖子标题",
        "author":"NPC昵称",
        "content":"NPC回复"
    }
]

${history}

${ctx}
`;

            const raw =
                await callAI(
                    [
                        {
                            role:
                                'system',
                            content:
                                prompt
                        },

                        {
                            role:
                                'user',
                            content:
                                '生成NPC之间的论坛对话。'
                        }
                    ],
                    0.9
                );

            let arr =
                parseJSON(
                    raw
                );

            if (!Array.isArray(arr)) {

                arr =
                    arr
                        ? [arr]
                        : [];
            }

            let added =
                0;

            arr
                .slice(
                    0,
                    count
                )
                .forEach(
                    x => {

                        const t =
                            target.find(
                                t =>
                                    t.title ===
                                    x.threadTitle
                            ) ||
                            target[
                                Math.floor(
                                    Math.random() *
                                    target.length
                                )
                            ];

                        if (
                            t &&
                            x.author &&
                            x.content
                        ) {

                            t.posts.push(
                                {
                                    author:
                                        x.author,

                                    content:
                                        x.content,

                                    replies: []
                                }
                            );

                            added++;
                        }
                    }
                );

            saveChatState();

            renderForumList();

            showToast(
                'NPC互聊完成：' +
                added +
                ' 条'
            );

            return added;

        } catch (e) {

            showToast(
                'NPC互聊失败：' +
                e.message
            );

            return 0;
        }
    }

    // ============================================================
    // 玩家发帖
    // ============================================================

    function openPostComposer() {
        const modal = $('pkmn-post-modal');
        if (!modal) return;
        const profile = currentUserProfile();
        $('pkmn-post-profile-hint').textContent =
            `当前身份：${profile.nickname} · ${profile.bio || '暂无简介'}`;
        $('pkmn-post-title').value = '';
        $('pkmn-post-content').value = '';
        modal.classList.add('show');
        setTimeout(() => $('pkmn-post-title')?.focus(), 50);
    }

    function closePostComposer() {
        $('pkmn-post-modal')?.classList.remove('show');
    }

    async function submitUserPost() {
        if (generating) return;
        const title = $('pkmn-post-title').value.trim();
        const content = $('pkmn-post-content').value.trim();
        if (!title || !content) {
            showToast('请填写帖子标题和正文');
            return;
        }

        const profile = currentUserProfile();
        const t = {
            id: makeId(),
            board: currentBoard,
            title,
            author: profile.nickname,
            authorBio: profile.bio,
            isUserThread: true,
            time: '刚刚',
            posts: [{
                author: profile.nickname,
                authorBio: profile.bio,
                isUser: true,
                content,
                replies: []
            }]
        };

        const arr = threads();
        arr.push(t);
        setThreads(arr);
        saveChatState();
        closePostComposer();
        renderForumList();
        openThread(t.id);

        const n = Math.max(0, Math.min(20, parseInt(config.userReplies) || 0));
        if (n > 0) {
            await generateReplies(t, content, n, '玩家发帖');
            openThread(t.id);
        }
    }


    function normalizeForumThreads() {
        const arr = threads();
        let changed = false;

        arr.forEach(t => {
            if (!Array.isArray(t.posts)) {
                t.posts = [];
                changed = true;
            }

            t.posts.forEach(p => {
                if (!Array.isArray(p.replies)) {
                    p.replies = [];
                    changed = true;
                }
            });
        });

        if (changed) {
            setThreads(arr);
            saveChatState();
        }
    }

    // ============================================================
    // 玩家回复
    // ============================================================

    async function sendUserReply() {

        const input =
            $('pkmn-reply-input');

        const text =
            input.value.trim();

        if (!text) {
            return;
        }

        const t =
            threads().find(
                x =>
                    x.id ===
                    currentThreadId
            );

        if (!t) {
            return;
        }

        const replyProfile = currentUserProfile();
        t.posts.push(
            {
                author:
                    replyProfile.nickname,

                authorBio:
                    replyProfile.bio,

                isUser: true,

                content:
                    text,

                replies: []
            }
        );

        saveChatState();

        input.value =
            '';

        openThread(
            t.id
        );

        const n =
            Math.max(
                1,
                parseInt(
                    config.userReplies
                ) || 3
            );

        showToast(
            '正在生成 ' +
            n +
            ' 条对应回复…'
        );

        await generateReplies(
            t,
            text,
            n,
            '玩家回复'
        );

        openThread(
            t.id
        );
    }

    // ============================================================
    // 设置页面
    // ============================================================

    function renderSettings() {

        const body =
            $('pkmn-settings-body');

        const safe =
            config.safeBoards;

        const mature =
            config.matureBoards;

        body.innerHTML =
            `

<div class="pkmn-group">

    <div class="pkmn-label">
        正文读取层数
    </div>

    <input
        class="pkmn-input"
        id="set-depth"
        type="number"
        min="1"
        max="100"
        value="${config.readDepth}"
    >

    <div class="pkmn-small">
        生成论坛内容时读取当前聊天最后 N 层正文。
    </div>

    <label class="pkmn-check">
        <input type="checkbox" id="set-wb-smart" ${config.worldbookSmartFilter ? 'checked' : ''}>
        智能筛选与当前剧情相关的世界书条目
    </label>

    <div class="pkmn-row">
        <input class="pkmn-input" id="set-wb-max" type="number" min="1" max="100" value="${config.worldbookMaxEntries}" title="最多世界书条目数">
        <input class="pkmn-input" id="set-wb-chars" type="number" min="4000" max="45000" step="1000" value="${config.worldbookMaxChars}" title="世界书最大字符数">
    </div>

    <div class="pkmn-small">
        依次为：最多送入的世界书条目数 / 世界书字符预算。关闭智能筛选时按世界书条目顺序读取。
    </div>

</div>


<div class="pkmn-group">

    <div class="pkmn-label">
        论坛生成参数
    </div>

    <div class="pkmn-row">

        <input
            class="pkmn-input"
            id="set-refresh"
            type="number"
            min="0"
            max="20"
            value="${config.refreshPosts}"
            title="刷新生成帖子数"
        >

        <input
            class="pkmn-input"
            id="set-user-reply"
            type="number"
            min="0"
            max="20"
            value="${config.userReplies}"
            title="玩家每次触发回复数"
        >

        <input
            class="pkmn-input"
            id="set-npc-talk"
            type="number"
            min="0"
            max="20"
            value="${config.npcTalks}"
            title="NPC互聊数"
        >

    </div>

    <div class="pkmn-small">
        依次为：
        刷新帖子数 /
        玩家发帖或回复后生成的对应回复数 /
        NPC互聊数。
    </div>

    <label class="pkmn-check">

        <input
            type="checkbox"
            id="set-auto-npc"
            ${
                config.autoNpcTalk
                    ? 'checked'
                    : ''
            }
        >

        刷新板块后自动生成NPC互聊

    </label>

</div>


<!-- ======================================================
     API
     ====================================================== -->

<div class="pkmn-group">

    <div class="pkmn-label">
        API连接
    </div>

    <input
        class="pkmn-input"
        id="set-endpoint"
        placeholder="例如 https://xxx/v1"
        value="${esc(
            config.api.endpoint
        )}"
    >

    <input
        class="pkmn-input"
        id="set-key"
        type="password"
        placeholder="API Key"
        value="${esc(
            config.api.key
        )}"
    >

    <div
        class="pkmn-status-line"
        id="pkmn-api-status"
    >
        ${
            config.api.models?.length
                ? '● 已有模型缓存'
                : '● 未检测'
        }
    </div>


    <!-- 两个按钮完全分开 -->

    <div class="pkmn-row">

        <button
            class="pkmn-btn pkmn-secondary"
            id="set-test"
        >
            🔌 检测连接
        </button>

        <button
            class="pkmn-btn pkmn-secondary"
            id="set-load-models"
        >
            📥 加载模型
        </button>

    </div>


    <div
        class="pkmn-row"
        style="margin-top:8px"
    >

        <select
            class="pkmn-select"
            id="set-model"
        >

            ${
                (
                    config.api.models ||
                    []
                )
                    .map(
                        m =>
                            `
<option
    value="${esc(m)}"
    ${
        m ===
        config.api.model
            ? 'selected'
            : ''
    }
>
    ${esc(m)}
</option>
`
                    )
                    .join('')

                ||

                '<option value="">未获取</option>'
            }

        </select>

    </div>


    <button
        class="pkmn-btn pkmn-primary"
        id="set-save-api"
        style="
            width:100%;
            margin-top:8px
        "
    >
        💾 保存API
    </button>

</div>


<!-- 世界书：折叠，避免世界书很多时把设置页拉得过长 -->
<div class="pkmn-group pkmn-worldbook-group">
    <details id="pkmn-worldbook-details">
        <summary class="pkmn-worldbook-summary">
            <span>📚 选择世界书</span>
            <span id="pkmn-worldbook-count" class="pkmn-worldbook-count">已选 0 本</span>
        </summary>
        <div class="pkmn-worldbook-panel">
            <div class="pkmn-small" style="margin-bottom:8px">可展开选择一个或多个世界书；世界书很多时不会继续拉长设置页面。</div>
            <div id="worldbook-list">
                <div class="pkmn-small">正在读取世界书列表…</div>
            </div>
            <button class="pkmn-btn pkmn-secondary" id="set-refresh-wb" style="margin-top:8px;width:100%">
                🔄 刷新世界书列表
            </button>
        </div>
    </details>
</div>


<!-- 玩家论坛身份 -->
<div class="pkmn-group">
    <div class="pkmn-label">玩家论坛身份</div>
    <div class="pkmn-small">两个论坛分别保存自己的昵称和简介；发帖、回复时只使用当前论坛对应的身份。</div>

    <div style="margin-top:10px;font-weight:700;font-size:12px">宝宝宝可萌大师</div>
    <input class="pkmn-input" id="set-safe-nickname" maxlength="40" placeholder="安全论坛昵称" value="${esc(config.userProfiles.safe.nickname)}">
    <textarea class="pkmn-textarea" id="set-safe-bio" maxlength="300" placeholder="安全论坛个人简介" style="min-height:70px">${esc(config.userProfiles.safe.bio)}</textarea>

    <div style="margin-top:10px;font-weight:700;font-size:12px">91宝可梦论坛</div>
    <input class="pkmn-input" id="set-mature-nickname" maxlength="40" placeholder="成熟论坛昵称" value="${esc(config.userProfiles.mature.nickname)}">
    <textarea class="pkmn-textarea" id="set-mature-bio" maxlength="300" placeholder="成熟论坛个人简介" style="min-height:70px">${esc(config.userProfiles.mature.bio)}</textarea>
</div>

<!-- 安全论坛 -->

<div class="pkmn-group">

    <div class="pkmn-label">
        安全论坛板块名称与AI提示词
    </div>

    <div
        id="safe-board-settings"
    ></div>

</div>


<!-- 成熟论坛 -->

<div class="pkmn-group">

    <div class="pkmn-label">
        成熟向论坛板块名称与AI提示词
    </div>

    <div class="pkmn-small">
        此区域只保存非露骨的成人向/暧昧社区设定。
    </div>

    <div
        id="mature-board-settings"
    ></div>

</div>


<!-- 保存 -->

<div class="pkmn-group">

    <button
        class="pkmn-btn pkmn-primary"
        id="set-save-all"
        style="width:100%"
    >
        💾 保存全部设置
    </button>

    <button
        class="pkmn-btn pkmn-danger"
        id="set-clear-current"
        style="
            width:100%;
            margin-top:8px
        "
    >
        清空当前聊天论坛存档
    </button>

</div>

`;

        // 板块设置

        renderBoardSettingList(
            'safe-board-settings',
            safe
        );

        renderBoardSettingList(
            'mature-board-settings',
            mature
        );

        // 世界书

        renderWorldbooks();

        // ======================================================
        // 基础参数
        // ======================================================

        $('set-depth').onchange =
            () => {

                config.readDepth =
                    Math.max(
                        1,
                        Math.min(
                            100,
                            parseInt(
                                $('set-depth').value
                            ) || 12
                        )
                    );
            };

        $('set-wb-smart').onchange =
            () => {
                config.worldbookSmartFilter = $('set-wb-smart').checked;
            };

        $('set-wb-max').onchange =
            () => {
                config.worldbookMaxEntries = Math.max(1, Math.min(100, parseInt($('set-wb-max').value) || 36));
            };

        $('set-wb-chars').onchange =
            () => {
                config.worldbookMaxChars = Math.max(4000, Math.min(45000, parseInt($('set-wb-chars').value) || 26000));
            };

        $('set-refresh').onchange =
            () => {

                config.refreshPosts =
                    Math.max(
                        0,
                        Math.min(
                            20,
                            parseInt(
                                $('set-refresh').value
                            ) || 0
                        )
                    );
            };

        $('set-user-reply').onchange =
            () => {

                config.userReplies =
                    Math.max(
                        0,
                        Math.min(
                            20,
                            parseInt(
                                $('set-user-reply').value
                            ) || 0
                        )
                    );
            };

        $('set-npc-talk').onchange =
            () => {

                config.npcTalks =
                    Math.max(
                        0,
                        Math.min(
                            20,
                            parseInt(
                                $('set-npc-talk').value
                            ) || 0
                        )
                    );
            };

        $('set-auto-npc').onchange =
            () => {

                config.autoNpcTalk =
                    $('set-auto-npc')
                        .checked;
            };


        // ======================================================
        // 检测连接
        // ======================================================

        $('set-test').onclick =
            async () => {

                const btn =
                    $('set-test');

                const status =
                    $('pkmn-api-status');

                // 先读取当前输入框
                config.api.endpoint =
                    $('set-endpoint')
                        .value
                        .trim();

                config.api.key =
                    $('set-key')
                        .value
                        .trim();

                // 防止重复点击
                btn.disabled =
                    true;

                btn.textContent =
                    '检测中…';

                status.textContent =
                    '● 正在检测';

                const result =
                    await detectConnection(
                        false
                    );

                if (result) {

                    status.textContent =
                        '● 连接成功';

                } else {

                    status.textContent =
                        '● 连接失败';
                }

                // 恢复按钮
                btn.disabled =
                    false;

                btn.textContent =
                    '🔌 检测连接';
            };


        // ======================================================
        // 加载模型
        // ======================================================

        $('set-load-models').onclick =
            async () => {

                const btn =
                    $('set-load-models');

                const status =
                    $('pkmn-api-status');

                const select =
                    $('set-model');

                config.api.endpoint =
                    $('set-endpoint')
                        .value
                        .trim();

                config.api.key =
                    $('set-key')
                        .value
                        .trim();

                btn.disabled =
                    true;

                btn.textContent =
                    '加载中…';

                status.textContent =
                    '● 正在加载模型';

                const models =
                    await fetchModelsOnly(
                        false
                    );

                if (models.length) {

                    status.textContent =
                        '● 已加载 ' +
                        models.length +
                        ' 个模型';

                    select.innerHTML =
                        models
                            .map(
                                m =>
                                    `
<option
    value="${esc(m)}"
    ${
        m ===
        config.api.model
            ? 'selected'
            : ''
    }
>
    ${esc(m)}
</option>
`
                            )
                            .join('');

                } else {

                    status.textContent =
                        '● 加载失败';
                }

                btn.disabled =
                    false;

                btn.textContent =
                    '📥 加载模型';
            };


        // ======================================================
        // 保存API
        // ======================================================

        $('set-save-api').onclick =
            () => {

                config.api.endpoint =
                    $('set-endpoint')
                        .value
                        .trim();

                config.api.key =
                    $('set-key')
                        .value
                        .trim();

                config.api.model =
                    $('set-model')
                        .value ||
                    config.api.model;

                saveGlobalConfig();

                showToast(
                    'API配置已保存'
                );
            };


        // 世界书刷新

        $('set-refresh-wb').onclick =
            renderWorldbooks;


        // 保存全部

        $('set-save-all').onclick =
            saveAllSettings;


        // 清空当前聊天

        $('set-clear-current').onclick =
            () => {

                if (
                    confirm(
                        '确定清空当前聊天的全部论坛帖子？'
                    )
                ) {

                    chatState =
                        makeChatState();

                    chatState.chatKey =
                        getChatKey();

                    saveChatState();

                    renderForumList();

                    showToast(
                        '当前聊天论坛存档已清空'
                    );
                }
            };
    }

    // ============================================================
    // 板块设置
    // ============================================================

    function renderBoardSettingList(
        containerId,
        list
    ) {

        const box =
            $(containerId);

        box.innerHTML =
            '';

        list.forEach(
            b => {

                const d =
                    topDoc.createElement(
                        'div'
                    );

                d.className =
                    'pkmn-board-item';

                d.innerHTML =
                    `
<div class="pkmn-small">
    ${esc(b.id)}
</div>

<input
    class="pkmn-input b-name"
    value="${esc(b.name)}"
    placeholder="板块名称"
>

<textarea
    class="pkmn-textarea b-prompt"
    placeholder="这个板块给AI的提示词"
>
${esc(b.prompt)}
</textarea>
`;

                d.querySelector(
                    '.b-name'
                ).oninput =
                    e =>
                        b.name =
                            e.target.value;

                d.querySelector(
                    '.b-prompt'
                ).oninput =
                    e =>
                        b.prompt =
                            e.target.value;

                box.appendChild(
                    d
                );
            }
        );
    }

    // ============================================================
    // 世界书
    // ============================================================

    async function renderWorldbooks() {

        const box =
            $('worldbook-list');

        const countBox = topDoc.getElementById('pkmn-worldbook-count');
        const updateWorldbookCount = () => {
            if (countBox) countBox.textContent = `已选 ${config.worldbooks.length} 本`;
        };
        updateWorldbookCount();

        if (!box) {
            return;
        }

        let names = [];

        try {

            if (
                ST.getWorldbookNames
            ) {

                names =
                    ST.getWorldbookNames() ||
                    [];
            }

        } catch (_) {}

        if (!names.length) {

            box.innerHTML =
                `
<div class="pkmn-small">
当前环境没有可读取的世界书接口。
</div>
`;

            updateWorldbookCount();
            return;
        }

        box.innerHTML =
            '';

        names.forEach(
            name => {

                const label =
                    topDoc.createElement(
                        'label'
                    );

                label.className =
                    'pkmn-check';

                const checked =
                    config.worldbooks
                        .includes(
                            name
                        );

                label.innerHTML =
                    `
<input
    type="checkbox"
    value="${esc(name)}"
    ${
        checked
            ? 'checked'
            : ''
    }
>
${esc(name)}
`;

                label.querySelector(
                    'input'
                ).onchange =
                    e => {

                        if (
                            e.target
                                .checked
                        ) {

                            if (
                                !config.worldbooks
                                    .includes(
                                        name
                                    )
                            ) {

                                config.worldbooks
                                    .push(
                                        name
                                    );
                            }

                        } else {

                            config.worldbooks =
                                config.worldbooks
                                    .filter(
                                        x =>
                                            x !==
                                            name
                                    );
                        }

                        saveGlobalConfig();
                        updateWorldbookCount();
                    };

                box.appendChild(
                    label
                );
            }
        );
    }

    // ============================================================
    // 保存全部设置
    // ============================================================

    function saveAllSettings() {

        if (
            $('set-endpoint')
        ) {

            config.api.endpoint =
                $('set-endpoint')
                    .value
                    .trim();
        }

        if (
            $('set-key')
        ) {

            config.api.key =
                $('set-key')
                    .value
                    .trim();
        }

        if (
            $('set-model')
        ) {

            config.api.model =
                $('set-model').value ||
                config.api.model;
        }

        if ($('set-safe-nickname')) {
            config.userProfiles.safe.nickname = $('set-safe-nickname').value.trim() || '旅行中的训练家';
            config.userProfiles.safe.bio = $('set-safe-bio').value.trim();
        }
        if ($('set-mature-nickname')) {
            config.userProfiles.mature.nickname = $('set-mature-nickname').value.trim() || '匿名用户';
            config.userProfiles.mature.bio = $('set-mature-bio').value.trim();
        }

        saveGlobalConfig();

        renderTabs();

        renderForumList();

        showToast(
            '全部论坛设置已保存'
        );
    }

    // ============================================================
    // 事件
    // ============================================================

    $('pkmn-open-safe').onclick =
        () => {

            currentForum =
                'safe';

            currentBoard =
                'all';

            renderForumList();

            openView(
                'forum'
            );
        };

    $('pkmn-open-mature').onclick =
        () => {

            currentForum =
                'mature';

            currentBoard =
                'm_all';

            renderForumList();

            openView(
                'forum'
            );
        };

    $('pkmn-open-settings').onclick =
        () => {

            renderSettings();

            openView(
                'settings'
            );
        };

    $('pkmn-back-home').onclick =
        () =>
            openView(
                'home'
            );

    $('pkmn-settings-back').onclick =
        () =>
            openView(
                'home'
            );

    $('pkmn-back-forum').onclick =
        () => {

            renderForumList();

            openView(
                'forum'
            );
        };

    $('pkmn-homebar').onclick =
        () =>
            openView(
                'home'
            );


    // ============================================================
    // 刷新生成
    // ============================================================

    $('pkmn-refresh').onclick =
        async () => {

            const n =
                Math.max(
                    0,
                    parseInt(
                        config.refreshPosts
                    ) || 0
                );

            if (n <= 0) {

                showToast(
                    '刷新生成数量为0'
                );

                return;
            }

            await generatePosts(
                n,
                currentBoard
            );

            if (
                config.autoNpcTalk &&
                config.npcTalks > 0
            ) {

                await npcTalk(
                    config.npcTalks
                );
            }
        };


    // ============================================================
    // 生成
    // ============================================================

    $('pkmn-generate').onclick =
        async () => {

            // 立即反馈点击，直到所有生成任务完成才关闭。
            // 同时锁定按钮，防止重复点击触发多次 API 请求。
            const btn = $('pkmn-generate');
            if (generating) return;

            if (btn) {
                btn.disabled = true;
                btn.dataset.oldText = btn.textContent;
                btn.textContent = '生成中…';
            }

            try {
                const n =
                    Math.max(
                        0,
                        parseInt(
                            config.refreshPosts
                        ) || 0
                    );

                await generatePosts(
                    n,
                    currentBoard
                );

                if (
                    config.autoNpcTalk &&
                    config.npcTalks > 0
                ) {

                    await npcTalk(
                        config.npcTalks
                    );
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.oldText || '✨刷新/生成';
                    delete btn.dataset.oldText;
                }
            }
        };


    // ============================================================
    // NPC互聊
    // ============================================================

    $('pkmn-npc-talk').onclick =
        () =>
            npcTalk(
                Math.max(
                    0,
                    parseInt(
                        config.npcTalks
                    ) || 0
                )
            );


    // ============================================================
    // 清空板块
    // ============================================================

    $('pkmn-clear').onclick =
        () => {

            const b =
                boardDef(
                    currentBoard
                );

            if (
                confirm(
                    '清空【' +
                    b.name +
                    '】的帖子？'
                )
            ) {

                setThreads(
                    threads()
                        .filter(
                            t =>
                                t.board !==
                                currentBoard
                        )
                );

                saveChatState();

                renderForumList();

                showToast(
                    '板块已清空'
                );
            }
        };


    // ============================================================
    // 板块设置
    // ============================================================

    $('pkmn-board-settings').onclick =
        () => {

            renderSettings();

            openView(
                'settings'
            );
        };


    // ============================================================
    // 玩家回复
    // ============================================================

    $('pkmn-new-post').onclick =
        openPostComposer;

    $('pkmn-post-cancel').onclick =
        closePostComposer;

    $('pkmn-post-submit').onclick =
        submitUserPost;

    $('pkmn-send').onclick =
        sendUserReply;

    $('pkmn-reply-input').onkeydown =
        e => {

            if (
                e.key ===
                'Enter'
            ) {

                sendUserReply();
            }
        };


    // ============================================================
    // 手机按钮
    // ============================================================

    // ============================================================
    // 悬浮洛托姆：自由拖动 + 轻触打开
    // ============================================================

    let floatMoved = false;
    let dragState = null;
    let suppressNextOpen = false;

    const dragWindow =
        (topDoc && topDoc.defaultView)
            ? topDoc.defaultView
            : window;

    function clampFloatPosition(left, top) {
        const margin = 6;
        const width = floatBtn.offsetWidth || 52;
        const height = floatBtn.offsetHeight || 52;
        const viewportW = dragWindow.innerWidth || document.documentElement.clientWidth;
        const viewportH = dragWindow.innerHeight || document.documentElement.clientHeight;
        const maxLeft = Math.max(margin, viewportW - width - margin);
        const maxTop = Math.max(margin, viewportH - height - margin);
        return {
            left: Math.min(maxLeft, Math.max(margin, left)),
            top: Math.min(maxTop, Math.max(margin, top))
        };
    }

    function applyFloatPosition(left, top) {
        const pos = clampFloatPosition(left, top);
        floatBtn.style.left = pos.left + 'px';
        floatBtn.style.top = pos.top + 'px';
        floatBtn.style.right = 'auto';
        floatBtn.style.bottom = 'auto';
    }

    function saveFloatPosition() {
        const rect = floatBtn.getBoundingClientRect();
        localStorage.setItem(NS + '_float_pos', JSON.stringify({
            left: Math.round(rect.left),
            top: Math.round(rect.top)
        }));
    }

    function restoreFloatPosition() {
        try {
            const p = JSON.parse(localStorage.getItem(NS + '_float_pos') || 'null');
            if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) {
                applyFloatPosition(p.left, p.top);
            } else {
                // 首次运行放在右下角，但使用 left/top 作为最终坐标，避免拖动时
                // left 与 right 同时参与定位造成跳动。
                const w = floatBtn.offsetWidth || 52;
                const h = floatBtn.offsetHeight || 52;
                applyFloatPosition(
                    (dragWindow.innerWidth || 360) - w - 18,
                    (dragWindow.innerHeight || 640) - h - 96
                );
                saveFloatPosition();
            }
        } catch (_) {}
    }

    function openPhone() {
        switchChat();
        openView('home');
        panel.classList.add('show');
    }

    function closePhone() {
        panel.classList.remove('show');
    }

    function togglePhone(e) {
        // 彻底阻止点击穿透到酒馆底层控件，避免 Android/WebView
        // 把一次触摸误判成“返回/导航”。
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }
        }
        if (panel.classList.contains('show')) {
            closePhone();
        } else {
            openPhone();
        }
    }

    function beginFloatDrag(e) {
        if (!e) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const rect = floatBtn.getBoundingClientRect();
        floatMoved = false;
        suppressNextOpen = false;
        dragState = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top
        };
        floatBtn.classList.add('dragging');
        try { floatBtn.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
    }

    function moveFloatDrag(e) {
        if (!dragState || !e || e.pointerId !== dragState.pointerId) return;
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            floatMoved = true;
            suppressNextOpen = true;
        }
        applyFloatPosition(
            dragState.startLeft + dx,
            dragState.startTop + dy
        );
        e.preventDefault();
    }

    function finishFloatDrag(e) {
        if (!dragState) return;
        if (e && e.pointerId !== undefined && e.pointerId !== dragState.pointerId) return;
        const moved = floatMoved;
        const pointerId = dragState.pointerId;
        try { floatBtn.releasePointerCapture(pointerId); } catch (_) {}
        floatBtn.classList.remove('dragging');
        saveFloatPosition();
        dragState = null;
        floatMoved = false;
        // 只在真正的轻触时切换开关；拖动结束绝不打开/关闭。
        if (!moved && !suppressNextOpen) togglePhone(e);
        suppressNextOpen = false;
    }

    // Android/WebView 兼容：优先使用 Pointer Events，同时保留 Touch Events
    // 兜底。旧版本只监听 pointerdown，部分手机酒馆环境中会因此完全没有
    // 触发打开动作。
    let touchStart = null;
    let pointerGestureActive = false;

    ['click','touchstart','touchend'].forEach(type => {
        floatBtn.addEventListener(type, e => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }, { passive: false, capture: true });
    });

    floatBtn.addEventListener('pointerdown', e => {
        pointerGestureActive = true;
        beginFloatDrag(e);
    }, { passive: false, capture: true });

    dragWindow.addEventListener('pointermove', moveFloatDrag, { passive: false });
    dragWindow.addEventListener('pointerup', e => {
        finishFloatDrag(e);
        setTimeout(() => { pointerGestureActive = false; }, 0);
    }, { passive: false });
    dragWindow.addEventListener('pointercancel', e => {
        finishFloatDrag(e);
        setTimeout(() => { pointerGestureActive = false; }, 0);
    }, { passive: false });

    floatBtn.addEventListener('lostpointercapture', e => {
        if (dragState && e.pointerId === dragState.pointerId) finishFloatDrag(e);
    });

    floatBtn.addEventListener('touchstart', e => {
        if (pointerGestureActive) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
        e.preventDefault();
    }, { passive: false, capture: true });

    floatBtn.addEventListener('touchend', e => {
        if (pointerGestureActive) return;
        if (!touchStart) return;
        const t = e.changedTouches && e.changedTouches[0];
        const dx = t ? t.clientX - touchStart.x : 0;
        const dy = t ? t.clientY - touchStart.y : 0;
        const elapsed = Date.now() - touchStart.time;
        touchStart = null;
        if (Math.hypot(dx, dy) <= 10 && elapsed < 700) {
            togglePhone(e);
        }
        e.preventDefault();
    }, { passive: false, capture: true });

    dragWindow.addEventListener('resize', () => {
        const rect = floatBtn.getBoundingClientRect();
        applyFloatPosition(rect.left, rect.top);
        saveFloatPosition();
    });

    // 手机右上角独立关闭按钮：不依赖返回键，不触发 openView。
    const closePhoneBtn = $('pkmn-close-phone');
    if (closePhoneBtn) {
        ['pointerdown','touchstart','click'].forEach(type => {
            closePhoneBtn.addEventListener(type, e => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                if (type === 'click' || type === 'pointerdown') closePhone();
            }, { passive: false, capture: true });
        });
    }

    // 面板自身也是事件隔离区，防止点击/滑动穿透到底层酒馆。
    ['pointerdown','pointerup','click'].forEach(type => {
        panel.addEventListener(type, e => {
            if (e.target === closePhoneBtn) return;
            e.stopPropagation();
        }, { passive: false });
    });

    restoreFloatPosition();


    // ============================================================
    // 自动聊天切换 / 新建聊天
    // ============================================================

    if (ST.eventOn) {

        try {

            const events = ST.eventTypes();
            const changedEv = events.CHAT_CHANGED || 'CHAT_CHANGED';
            const createdEv = events.CHAT_CREATED || 'CHAT_CREATED';

            // 切换到已有聊天：
            // 读取该 chatId 对应的论坛存档。
            ST.eventOn(
                changedEv,
                newChatId => {

                    setTimeout(
                        () => {

                            const key =
                                newChatId !== undefined &&
                                newChatId !== null
                                    ? 'chat:' + String(newChatId)
                                    : getChatKey();

                            switchChat(
                                key
                            );

                        },
                        300
                    );

                }
            );

            // 创建新聊天：
            // 无论之前论坛是什么内容，新聊天都从空论坛开始。
            ST.eventOn(
                createdEv,
                newChatId => {

                    setTimeout(
                        () => {

                            resetForumForNewChat(
                                newChatId
                            );

                        },
                        300
                    );

                }
            );

        } catch (_) {}
    }


    // ============================================================
    // 定时兜底检测
    // ============================================================
    // 某些酒馆版本/切换方式可能没有正常触发事件。
    // 这里每 1.5 秒比较一次真正的 chatId。
    // 注意：这里绝不在切换时 saveChatState()，避免写错聊天。

    let lastChatKey =
        getChatKey();

    setInterval(
        () => {

            const k =
                getChatKey();

            if (
                k &&
                k !==
                lastChatKey
            ) {

                lastChatKey =
                    k;

                switchChat(
                    k,
                    true
                );
            }

        },
        1500
    );


    // ============================================================
    // 时间
    // ============================================================

    setInterval(
        () => {

            const d =
                new Date();

            $('pkmn-time')
                .textContent =
                    String(
                        d.getHours()
                    ).padStart(
                        2,
                        '0'
                    ) +
                    ':' +
                    String(
                        d.getMinutes()
                    ).padStart(
                        2,
                        '0'
                    );

        },
        1000
    );


    // ============================================================
    // 初始载入
    // ============================================================

    chatState =
        loadChatState(
            getChatKey()
        );

    loadFromChatMetadata();

    normalizeForumThreads();

    renderForumList();


    // ============================================================
    // 如果已有API配置
    // 后台自动检测
    // ============================================================

    if (
        config.api.autoDetect &&
        config.api.endpoint
    ) {

        setTimeout(
            () =>
                detectAndFetchModels(
                    true
                ),
            700
        );
    }


    console.log(
        '[宝可梦小手机论坛] 已启动。聊天独立存档：',
        chatState.chatKey
    );

})();