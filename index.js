(function () {
    'use strict';

    const NS = 'pkmn_phone_forum_native_v1';
    const LEGACY_NS = 'pkmn_phone_forum_v7';
    const LEGACY_NS_2 = 'pkmn_phone_forum_v5';
    const VERSION = 21;

    const ST = (window.SillyTavern && typeof window.SillyTavern.getContext === 'function')
        ? window.SillyTavern.getContext()
        : null;
    if (!ST) throw new Error('SillyTavern context unavailable');
    const topDoc = document;
    const getRequestHeaders = () => typeof ST.getRequestHeaders === 'function' ? ST.getRequestHeaders() : { 'Content-Type': 'application/json' };

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
    // SillyTavern 原生 API
    // ============================================================

    const ST_EVENTS = ST.eventTypes || {};

    async function nativeGetWorldbook(name) {
        if (!name) return null;
        try {
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { ...getRequestHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
                cache: 'no-cache',
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (_) {
            return null;
        }
    }

    async function nativeGetWorldbookNames() {
        try {
            const response = await fetch('/api/worldinfo/list', {
                method: 'POST',
                headers: { ...getRequestHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
                cache: 'no-cache',
            });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) return data.map(x => typeof x === 'string' ? x : (x.name || x.file_id)).filter(Boolean);
                if (Array.isArray(data.world_names)) return data.world_names;
            }
        } catch (_) {}
        try {
            const response = await fetch('/api/settings/get', {
                method: 'POST',
                headers: { ...getRequestHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
                cache: 'no-cache',
            });
            if (response.ok) {
                const data = await response.json();
                return Array.isArray(data.world_names) ? data.world_names : [];
            }
        } catch (_) {}
        return [];
    }

    function getNativeChatMessages() {
        return Array.isArray(ST.chat) ? ST.chat : [];
    }

    function getNativeCharacterName() {
        return ST.name1 || '玩家';
    }
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
                getNativeCharacterName();

            let first = '';

            {

                const a =
                    getNativeChatMessages().slice(-1);

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

            ST.updateChatMetadata({ [NS]: clone(chatState) }, false);
            if (typeof ST.saveMetadata === 'function') ST.saveMetadata();

        } catch (_) {}
    }

    function loadFromChatMetadata(expectedKey = null) {

        try {

            if (
                ST.chatMetadata && ST.chatMetadata[NS]
            ) {

                const s =
                    ST.chatMetadata[NS];

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

            {

                const msgs = getNativeChatMessages().slice(-depth);

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
        if (!config.worldbooks.length) return [];

        const keywords = extractContextKeywords(chatText);
        const all = [];

        for (const name of config.worldbooks) {
            try {
                const book = await nativeGetWorldbook(name);
                const entries = book?.entries ? Object.values(book.entries) : (Array.isArray(book) ? book : []);
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

    const style =
        topDoc.createElement(
            'style'
        );

    style.id =
        'pkmn-phone-style';

    style.textContent = `
*{box-sizing:border-box}

#pkmn-float-btn{
position:fixed!important;
right:18px!important;
bottom:80px!important;
width:50px!important;
height:50px!important;
padding:0!important;
border-radius:50%!important;
background:transparent!important;
color:#fff!important;
display:flex!important;
align-items:center!important;
justify-content:center!important;
z-index:999999999!important;
box-shadow:0 3px 10px rgba(0,0,0,.28)!important;
cursor:grab!important;
touch-action:none!important;
user-select:none!important
}
#pkmn-float-btn.dragging{cursor:grabbing!important;transform:scale(1.06)!important}
#pkmn-float-btn svg{width:46px!important;height:46px!important;display:block!important;pointer-events:none!important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}

#pkmn-phone-panel{
position:fixed!important;
left:50%!important;
top:50%!important;
right:auto!important;
bottom:auto!important;
width:350px!important;
height:650px!important;
background:#f7f7f7!important;
border:7px solid #202124!important;
border-radius:38px!important;
overflow:hidden!important;
z-index:999999998!important;
display:none!important;
box-shadow:0 20px 55px rgba(0,0,0,.4)!important;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;
color:#222!important
}
#pkmn-phone-panel.show{display:flex!important;flex-direction:column!important}

#pkmn-close-phone{
position:absolute!important;
right:8px!important;
top:5px!important;
width:34px!important;
height:34px!important;
z-index:30!important;
border:0!important;
border-radius:50%!important;
background:rgba(0,0,0,.14)!important;
color:#fff!important;
font-size:24px!important;
line-height:34px!important;
padding:0!important;
cursor:pointer!important
}

/* 手机窗口拖动手柄：顶部黑色刘海区与底部白色Home区域 */
.pkmn-drag-top{
position:absolute!important;
left:50%!important;
top:0!important;
transform:translateX(-50%)!important;
width:150px!important;
height:28px!important;
z-index:25!important;
background:transparent!important;
touch-action:none!important;
user-select:none!important;
-webkit-user-select:none!important;
-webkit-touch-callout:none!important;
cursor:grab!important
}
.pkmn-drag-top:active{cursor:grabbing!important}
.pkmn-drag-bottom{
position:absolute!important;
left:0!important;
bottom:0!important;
width:100%!important;
height:32px!important;
z-index:60!important;
background:transparent!important;
touch-action:none!important;
user-select:none!important;
-webkit-user-select:none!important;
-webkit-touch-callout:none!important;
cursor:grab!important
}
.pkmn-drag-bottom:active{cursor:grabbing!important}
#pkmn-phone-scale{
position:absolute!important;
right:45px!important;
top:5px!important;
width:30px!important;
height:30px!important;
z-index:70!important;
border:0!important;
border-radius:50%!important;
background:rgba(0,0,0,.18)!important;
color:#fff!important;
font-size:16px!important;
line-height:30px!important;
padding:0!important;
cursor:pointer!important
}
.pkmn-status{
height:28px;
display:flex;
justify-content:space-between;
align-items:center;
padding:0 18px;
font-size:11px;
color:#222;
background:#fff
}
.pkmn-notch{
position:absolute;
top:0;
left:50%;
transform:translateX(-50%);
width:110px;
height:18px;
background:#111;
border-radius:0 0 12px 12px;
z-index:10
}
.pkmn-app{
position:relative;
flex:1;
overflow:hidden;
background:#f7f7f7
}
.pkmn-view{
position:absolute;
inset:0;
display:flex;
flex-direction:column;
background:#f7f7f7;
transition:transform .24s ease
}
#pkmn-home{background:linear-gradient(135deg,#ff7043,#7e57c2);transform:translateX(0)}
#pkmn-forum,#pkmn-settings,#pkmn-thread{transform:translateX(100%)}

.pkmn-head{
height:48px;
min-height:48px;
background:#fff;
color:#222;
padding:0 13px;
border-bottom:1px solid #ededed;
display:flex;
align-items:center;
justify-content:center;
position:relative;
font-size:16px;
font-weight:600
}
.pkmn-head button{
position:absolute;
left:9px;
top:0;
width:34px;
height:48px;
border:0;
background:transparent;
color:#222;
font-size:30px;
font-weight:300;
line-height:44px;
padding:0;
cursor:pointer
}
.pkmn-head button:not(:first-child){position:static;width:auto;height:auto;margin-left:auto;font-size:18px;line-height:1}

.pkmn-head #pkmn-refresh,
.pkmn-head #pkmn-board-settings{
position:absolute;
left:auto;
top:0;
font-size:18px;
line-height:48px
}
.pkmn-head #pkmn-refresh{right:46px}
.pkmn-head #pkmn-board-settings{right:9px}

.pkmn-tabs{
height:39px;
min-height:39px;
display:flex;
background:#fff;
border-bottom:1px solid #eee;
overflow-x:auto;
scrollbar-width:none
}
.pkmn-tabs::-webkit-scrollbar{display:none}
.pkmn-tab{
min-width:84px;
height:39px;
padding:0 10px;
display:flex;
align-items:center;
justify-content:center;
font-size:11px;
color:#999;
cursor:pointer;
white-space:nowrap;
position:relative
}
.pkmn-tab.active{
color:#222;
font-weight:700
}
.pkmn-tab.active:after{
content:'';
position:absolute;
bottom:0;
left:22px;
right:22px;
height:2px;
border-radius:2px;
background:#ff8a00
}

.pkmn-list{
flex:1;
overflow:auto;
padding:0;
background:#f7f7f7
}
.pkmn-thread-card{
background:#fff;
border:0;
border-bottom:1px solid #ededed;
padding:14px 14px 11px;
margin:0;
cursor:pointer;
position:relative;
min-height:104px
}
.pkmn-thread-card:active{background:#fafafa}
.pkmn-thread-avatar{
position:absolute;
left:14px;
top:15px;
width:38px;
height:38px;
border-radius:50%;
background:#f0f0f0;
display:flex;
align-items:center;
justify-content:center;
font-size:16px;
font-weight:700;
color:#888
}
.pkmn-thread-body{margin-left:50px;padding-right:3px}
.pkmn-thread-user{
font-size:11px;
color:#777;
line-height:18px;
white-space:nowrap;
overflow:hidden;
text-overflow:ellipsis;
padding-right:76px
}
.pkmn-thread-title{
font-weight:700;
font-size:14px;
color:#222;
line-height:1.45;
margin-top:1px;
padding-right:4px
}
.pkmn-thread-snippet{
font-size:11px;
line-height:1.55;
color:#666;
margin-top:4px;
display:-webkit-box;
-webkit-line-clamp:2;
-webkit-box-orient:vertical;
overflow:hidden
}
.pkmn-thread-footer{
display:flex;
align-items:center;
gap:10px;
margin-top:7px;
font-size:9px;
color:#aaa
}
.pkmn-thread-stat{white-space:nowrap}
.pkmn-thread-time{margin-left:auto}
.pkmn-inject{
position:absolute;
right:37px;
top:14px;
border:0;
background:#fff6ec;
color:#f28a20;
border-radius:10px;
padding:3px 6px;
font-size:9px;
font-weight:600;
cursor:pointer;
z-index:2
}
.pkmn-inject.active{background:#ff8a00;color:#fff}
.pkmn-del{
position:absolute;
right:10px;
top:15px;
width:20px;
height:20px;
border:0;
background:transparent;
color:#bbb;
font-size:12px;
padding:0;
z-index:2
}

.pkmn-bottom{
height:49px;
min-height:49px;
padding:7px 8px;
background:#fff;
border-top:1px solid #e9e9e9;
display:grid;
grid-template-columns:1.25fr 1fr 1fr .7fr;
gap:5px
}
.pkmn-btn{
border:0;
border-radius:8px;
padding:0 7px;
height:34px;
font-weight:600;
cursor:pointer;
font-size:10px;
white-space:nowrap
}
.pkmn-btn:disabled{opacity:.55;cursor:not-allowed}
.pkmn-primary{background:#ff8a00;color:#fff}
.pkmn-secondary{background:#f1f1f1;color:#444}
.pkmn-danger{background:#fff0ef;color:#d65b54}

.pkmn-posts{
flex:1;
overflow:auto;
padding:0 0 12px;
background:#f7f7f7;
-webkit-overflow-scrolling:touch
}

/* Thread injection row */
.pkmn-inject-bar{
padding:7px 12px;
background:#fff;
border-bottom:1px solid #eee;
position:sticky;
top:0;
z-index:5
}
.pkmn-thread-inject-btn{
width:100%;
height:30px;
border:0;
border-radius:6px;
background:#fff7ed;
color:#f28a20;
font-size:10px;
font-weight:600;
cursor:pointer
}
.pkmn-thread-inject-btn.active{background:#ff8a00;color:#fff}

/* Main post */
.pkmn-post{
background:#fff;
padding:16px 14px 15px;
margin:0;
position:relative;
border-bottom:8px solid #f7f7f7
}
.pkmn-post-head{
display:flex;
align-items:center;
gap:9px;
padding-right:52px
}
.pkmn-post-avatar{
width:40px;
height:40px;
min-width:40px;
border-radius:50%;
background:#f0f0f0;
display:flex;
align-items:center;
justify-content:center;
font-size:16px;
font-weight:700;
color:#888
}
.pkmn-post-user{min-width:0}
.pkmn-post-author{
font-size:13px;
font-weight:600;
color:#333;
line-height:18px;
white-space:nowrap;
overflow:hidden;
text-overflow:ellipsis
}
.pkmn-post-time{
font-size:9px;
color:#aaa;
margin-top:2px
}
.pkmn-post-floor{
position:absolute;
right:13px;
top:17px;
font-size:9px;
color:#aaa
}
.pkmn-post-title{
font-size:17px;
font-weight:700;
line-height:1.45;
color:#222;
margin:13px 0 7px
}
.pkmn-post .pkmn-content{
font-size:14px;
line-height:1.75;
white-space:pre-wrap;
word-break:break-word;
color:#222
}
.pkmn-post-tools{
display:flex;
align-items:center;
gap:16px;
margin-top:13px;
font-size:10px;
color:#999
}
.pkmn-post-tool{display:flex;align-items:center;gap:3px}
.pkmn-post-tool.accent{color:#ff8a00}

.pkmn-replies-title{
height:42px;
padding:0 14px;
display:flex;
align-items:center;
background:#fff;
font-size:13px;
font-weight:700;
color:#222;
border-bottom:1px solid #eee
}
.pkmn-thread-divider{display:none}

/* Top-level comments */
.pkmn-reply-msg{
display:flex;
align-items:flex-start;
gap:8px;
padding:11px 14px 8px;
background:#fff;
border-bottom:1px solid #f0f0f0;
position:relative
}
.pkmn-reply-avatar{
width:34px;
height:34px;
min-width:34px;
border-radius:50%;
background:#f0f0f0;
display:flex;
align-items:center;
justify-content:center;
font-size:14px;
color:#888;
font-weight:700
}
.pkmn-reply-main{
min-width:0;
flex:1;
max-width:none
}
.pkmn-reply-name{
font-size:11px;
font-weight:600;
color:#777;
line-height:16px;
margin:0 0 3px
}
.pkmn-reply-bubble{
display:block;
width:fit-content;
max-width:100%;
background:#fff;
border:0;
padding:0;
font-size:13px;
line-height:1.65;
color:#333;
white-space:pre-wrap;
word-break:break-word;
box-shadow:none
}
.pkmn-reply-meta{
font-size:9px;
color:#aaa;
margin-top:4px;
line-height:14px
}
.pkmn-reply-msg.is-user{
flex-direction:row-reverse
}
.pkmn-reply-msg.is-user .pkmn-reply-avatar{
background:#e5f6df;
color:#55a348
}
.pkmn-reply-msg.is-user .pkmn-reply-name{color:#55a348;text-align:right}
.pkmn-reply-msg.is-user .pkmn-reply-main{text-align:right}
.pkmn-reply-msg.is-user .pkmn-reply-bubble{
background:#d9fdd3;
border-radius:5px;
padding:6px 9px;
text-align:left
}
.pkmn-reply-msg.is-user .pkmn-reply-meta{text-align:right}

/* Tiny reply action */
.pkmn-comment-actions{
display:flex;
justify-content:flex-end;
align-items:center;
min-height:15px;
margin-top:2px
}
.pkmn-comment-reply-btn{
border:0;
background:transparent;
padding:0 2px;
font-size:9px;
line-height:15px;
color:#aaa;
cursor:pointer
}
.pkmn-comment-reply-btn:active{color:#666}

/* Nested replies */
.pkmn-nested-replies{
margin:5px 0 0;
padding:0;
border:0
}
.pkmn-nested-msg{
display:block;
padding:0;
margin:3px 0
}
.pkmn-nested-main{display:block;min-width:0;max-width:100%}
.pkmn-nested-bubble{
display:block;
width:100%;
box-sizing:border-box;
background:#f5f5f5;
border:0;
border-radius:4px;
padding:6px 8px;
font-size:10px;
line-height:1.5;
color:#444;
white-space:pre-wrap;
word-break:break-word
}
.pkmn-nested-name{
display:inline;
font-size:10px;
font-weight:600;
color:#58708e;
line-height:1.45
}
.pkmn-nested-name::after{content:'：';color:#888;font-weight:400}
.pkmn-nested-text{display:inline;font-size:10px;line-height:1.5;color:#444;white-space:pre-wrap;word-break:break-word}
.pkmn-nested-meta{display:none}
.pkmn-nested-msg.is-user .pkmn-nested-bubble{background:#eef8eb}
.pkmn-nested-msg.is-user .pkmn-nested-name{color:#4f8b4a}

/* Nested composer */
.pkmn-nested-composer{
display:none;
margin:6px 0 2px;
gap:5px;
align-items:center
}
.pkmn-nested-composer.show{display:flex}
.pkmn-nested-input{
flex:1;
min-width:0;
height:28px;
border:1px solid #e2e2e2;
border-radius:14px;
padding:0 10px;
font-size:10px;
background:#fff;
outline:none
}
.pkmn-nested-send{
border:0;
border-radius:14px;
height:28px;
padding:0 10px;
font-size:10px;
background:#ff8a00;
color:#fff;
cursor:pointer
}

/* Bottom reply composer */
.pkmn-reply{
height:48px;
min-height:48px;
display:flex;
align-items:center;
gap:7px;
padding:7px 9px;
background:#fff;
border-top:1px solid #e9e9e9
}
#pkmn-reply-input{
flex:1;
min-width:0;
height:34px;
border:1px solid #e1e1e1;
border-radius:17px;
background:#f7f7f7;
padding:0 13px;
font-size:12px;
color:#333;
outline:none
}
#pkmn-reply-input:focus{background:#fff;border-color:#ffb45f}
#pkmn-send{
width:38px;
height:34px;
min-width:38px;
padding:0;
border-radius:17px;
background:#ff8a00;
font-size:0;
position:relative
}
#pkmn-send:after{
content:'➤';
font-size:17px;
line-height:34px;
display:block;
transform:rotate(-12deg)
}

/* Settings */
.pkmn-settings{flex:1;overflow:auto;padding:10px;background:#f7f7f7}
.pkmn-group{background:#fff;border-radius:10px;padding:13px;margin-bottom:9px;border:1px solid #eee}
.pkmn-label{font-size:12px;font-weight:700;color:#444;margin:7px 0}
.pkmn-input,.pkmn-select,.pkmn-textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #ddd;border-radius:8px;background:#fafafa;font-size:12px}
.pkmn-textarea{min-height:100px;resize:vertical}
.pkmn-row{display:flex;gap:7px;align-items:center}
.pkmn-row>*{flex:1;min-width:0}
.pkmn-status-line{font-size:11px;margin:5px 0;color:#555}
.pkmn-board-item{border:1px solid #eee;border-radius:9px;padding:9px;margin-bottom:7px}
.pkmn-small{font-size:10px;color:#888;line-height:1.4}

/* Post composer */
.pkmn-modal{
position:absolute;
inset:0;
background:rgba(0,0,0,.35);
display:none;
align-items:flex-end;
justify-content:center;
z-index:50
}
.pkmn-modal.show{display:flex}
.pkmn-modal-box{
width:100%;
max-height:88%;
overflow:auto;
background:#fff;
border-radius:18px 18px 0 0;
padding:16px 14px 14px;
box-shadow:0 -8px 25px rgba(0,0,0,.15)
}
.pkmn-modal-box .pkmn-textarea{min-height:145px}

/* World book */
.pkmn-worldbook-group{padding:0;overflow:hidden}
.pkmn-worldbook-summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:13px;font-size:12px;font-weight:800;color:#444}
.pkmn-worldbook-summary::-webkit-details-marker{display:none}
.pkmn-worldbook-summary:after{content:'⌄';font-size:16px;color:#999;transition:transform .2s}
#pkmn-worldbook-details[open] .pkmn-worldbook-summary:after{transform:rotate(180deg)}
.pkmn-worldbook-count{font-size:10px;color:#777;font-weight:600;margin-left:auto;margin-right:8px}
.pkmn-worldbook-panel{padding:0 13px 13px;border-top:1px solid #f0f0f0;max-height:220px;overflow:auto}
.pkmn-worldbook-panel .pkmn-check{background:#fafafa;border-radius:8px;padding:8px 9px;margin:4px 0}
.pkmn-check{display:flex;align-items:center;gap:7px;padding:6px 0;font-size:12px}

.pkmn-home-apps{display:flex;gap:22px;flex-wrap:wrap;padding:48px 22px}
.pkmn-app-icon{width:68px;text-align:center;color:white;font-size:12px;cursor:pointer}
.pkmn-app-icon div:first-child{width:58px;height:58px;background:rgba(255,255,255,.92);border-radius:17px;display:flex;align-items:center;justify-content:center;font-size:30px;margin:auto auto 7px}
.pkmn-footer{height:24px;display:flex;align-items:center;justify-content:center;background:#fafafa}
.pkmn-homebar{width:100px;height:4px;background:#aaa;border-radius:5px;cursor:pointer}
`;

    topDoc.head.appendChild(
        style
    );

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
<button id="pkmn-phone-scale" type="button" aria-label="切换手机大小">↕</button>
<div class="pkmn-drag-top" id="pkmn-drag-top" aria-label="拖动手机"></div>

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
<div class="pkmn-drag-bottom" id="pkmn-drag-bottom" aria-label="拖动手机"></div>

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
    // 手机窗口：Android 触摸拖动 + 桌面鼠标拖动 + 半高/原高切换
    // ============================================================

    const dragTop = $('pkmn-drag-top');
    const dragBottom = $('pkmn-drag-bottom');
    const scaleBtn = $('pkmn-phone-scale');

    const phoneDragState = {
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        pointerId: null,
        touchId: null
    };

    const PHONE_FULL_HEIGHT = 650;
    const PHONE_HALF_HEIGHT = Math.round(PHONE_FULL_HEIGHT / 2);
    let phoneExpanded = false;

    function phoneViewport() {
        const win = topDoc.defaultView || window;
        return {
            width: Math.max(1, win.innerWidth || topDoc.documentElement.clientWidth || 360),
            height: Math.max(1, win.innerHeight || topDoc.documentElement.clientHeight || 640)
        };
    }

    function phoneSize() {
        const vp = phoneViewport();
        const width = Math.min(350, Math.max(260, vp.width - 24));
        const maxH = Math.max(260, vp.height - 24);
        const full = Math.min(PHONE_FULL_HEIGHT, maxH);
        const half = Math.min(PHONE_HALF_HEIGHT, Math.max(220, Math.floor(full / 2)));
        return { width, full, half };
    }

    function clampPhonePosition(left, top) {
        const vp = phoneViewport();
        const rect = panel.getBoundingClientRect();
        const w = rect.width || phoneSize().width;
        const h = rect.height || (phoneExpanded ? phoneSize().full : phoneSize().half);
        const margin = 8;
        const maxLeft = Math.max(margin, vp.width - w - margin);
        const maxTop = Math.max(margin, vp.height - h - margin);
        return {
            left: Math.min(Math.max(margin, left), maxLeft),
            top: Math.min(Math.max(margin, top), maxTop)
        };
    }

    function setPhonePosition(left, top) {
        const p = clampPhonePosition(left, top);
        panel.style.setProperty('left', p.left + 'px', 'important');
        panel.style.setProperty('top', p.top + 'px', 'important');
        panel.style.setProperty('right', 'auto', 'important');
        panel.style.setProperty('bottom', 'auto', 'important');
    }

    function centerPhoneInitial() {
        const vp = phoneViewport();
        const sz = phoneSize();
        const h = phoneExpanded ? sz.full : sz.half;
        panel.style.setProperty('width', sz.width + 'px', 'important');
        panel.style.setProperty('height', h + 'px', 'important');
        setPhonePosition((vp.width - sz.width) / 2, (vp.height - h) / 2);
    }

    function resizePhonePreservePosition() {
        const old = panel.getBoundingClientRect();
        const sz = phoneSize();
        const newH = phoneExpanded ? sz.full : sz.half;
        panel.style.setProperty('width', sz.width + 'px', 'important');
        panel.style.setProperty('height', newH + 'px', 'important');
        const left = old.left;
        const top = old.top;
        setPhonePosition(left, top);
    }

    function togglePhoneSize(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }
        const old = panel.getBoundingClientRect();
        phoneExpanded = !phoneExpanded;
        const sz = phoneSize();
        const newH = phoneExpanded ? sz.full : sz.half;
        panel.style.setProperty('width', sz.width + 'px', 'important');
        panel.style.setProperty('height', newH + 'px', 'important');
        // 尽量保持顶部位置，避免放大/缩小时跳屏。
        setPhonePosition(old.left, old.top);
        if (scaleBtn) scaleBtn.textContent = phoneExpanded ? '↕' : '↕';
    }

    function beginPhoneDrag(x, y, pointerId = null, touchId = null) {
        const rect = panel.getBoundingClientRect();
        phoneDragState.active = true;
        phoneDragState.moved = false;
        phoneDragState.startX = x;
        phoneDragState.startY = y;
        phoneDragState.startLeft = rect.left;
        phoneDragState.startTop = rect.top;
        phoneDragState.pointerId = pointerId;
        phoneDragState.touchId = touchId;
        panel.classList.add('pkmn-phone-dragging');
    }

    function movePhoneDrag(x, y, e) {
        if (!phoneDragState.active) return;
        const dx = x - phoneDragState.startX;
        const dy = y - phoneDragState.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) phoneDragState.moved = true;
        if (!phoneDragState.moved) return;
        if (e && e.cancelable) e.preventDefault();
        if (e) e.stopPropagation();
        setPhonePosition(phoneDragState.startLeft + dx, phoneDragState.startTop + dy);
    }

    function endPhoneDrag(e) {
        if (!phoneDragState.active) return;
        if (e && e.cancelable) e.preventDefault();
        if (e) e.stopPropagation();
        phoneDragState.active = false;
        phoneDragState.pointerId = null;
        phoneDragState.touchId = null;
        panel.classList.remove('pkmn-phone-dragging');
    }

    function bindPhoneDragHandle(handle) {
        if (!handle) return;
        handle.style.touchAction = 'none';
        handle.addEventListener('touchstart', e => {
            if (!e.touches || !e.touches.length) return;
            const t = e.touches[0];
            beginPhoneDrag(t.clientX, t.clientY, null, t.identifier);
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false, capture: true });
        handle.addEventListener('touchmove', e => {
            if (!phoneDragState.active || !e.touches) return;
            let t = null;
            for (const item of e.touches) {
                if (item.identifier === phoneDragState.touchId) { t = item; break; }
            }
            if (!t) t = e.touches[0];
            movePhoneDrag(t.clientX, t.clientY, e);
        }, { passive: false, capture: true });
        handle.addEventListener('touchend', endPhoneDrag, { passive: false, capture: true });
        handle.addEventListener('touchcancel', endPhoneDrag, { passive: false, capture: true });
        handle.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch') return;
            if (e.button !== undefined && e.button !== 0) return;
            beginPhoneDrag(e.clientX, e.clientY, e.pointerId, null);
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false, capture: true });
        handle.addEventListener('pointermove', e => {
            if (!phoneDragState.active || e.pointerType === 'touch') return;
            movePhoneDrag(e.clientX, e.clientY, e);
        }, { passive: false, capture: true });
        handle.addEventListener('pointerup', endPhoneDrag, { passive: false, capture: true });
        handle.addEventListener('pointercancel', endPhoneDrag, { passive: false, capture: true });
        handle.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            beginPhoneDrag(e.clientX, e.clientY, null, null);
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false, capture: true });
        handle.addEventListener('mousemove', e => {
            if (!phoneDragState.active) return;
            movePhoneDrag(e.clientX, e.clientY, e);
        }, { passive: false, capture: true });
        handle.addEventListener('mouseup', endPhoneDrag, { passive: false, capture: true });
    }

    bindPhoneDragHandle(dragTop);
    bindPhoneDragHandle(dragBottom);

    // 手指离开手柄后仍继续接收移动：直接监听顶层 window/document。
    const phoneDragWin = topDoc.defaultView || window;
    phoneDragWin.addEventListener('touchmove', e => {
        if (!phoneDragState.active || !e.touches) return;
        let t = null;
        for (const item of e.touches) {
            if (item.identifier === phoneDragState.touchId) { t = item; break; }
        }
        if (t) movePhoneDrag(t.clientX, t.clientY, e);
    }, { passive: false, capture: true });
    phoneDragWin.addEventListener('touchend', endPhoneDrag, { passive: false, capture: true });
    phoneDragWin.addEventListener('touchcancel', endPhoneDrag, { passive: false, capture: true });
    phoneDragWin.addEventListener('pointermove', e => {
        if (!phoneDragState.active || e.pointerType === 'touch') return;
        movePhoneDrag(e.clientX, e.clientY, e);
    }, { passive: false, capture: true });
    phoneDragWin.addEventListener('pointerup', endPhoneDrag, { passive: false, capture: true });
    phoneDragWin.addEventListener('pointercancel', endPhoneDrag, { passive: false, capture: true });
    phoneDragWin.addEventListener('mousemove', e => {
        if (phoneDragState.active) movePhoneDrag(e.clientX, e.clientY, e);
    }, { passive: false, capture: true });
    phoneDragWin.addEventListener('mouseup', endPhoneDrag, { passive: false, capture: true });

    if (scaleBtn) {
        // 只绑定 click。Android WebView 会把一次触摸同时转换成
        // touch/pointer/mouse/click；同时绑定多个事件会连续切换数次，
        // 表现为“点击没有变化”。
        scaleBtn.addEventListener('click', togglePhoneSize, { passive: false });
    }

    // 打开/初始化后强制保证手机在当前可视区内。
    centerPhoneInitial();
    phoneDragWin.addEventListener('resize', resizePhonePreservePosition, { passive: true });

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
            '1. 当前聊天中的主角/玩家，就是下面标记为【主角本人】的论坛用户。',
            '2. 【主角本人】发布的帖子或评论，是主角自己亲手发出的内容；主角知道这些内容是自己说过/发过的。',
            '3. 不要把【主角本人】的帖子或评论误认为其他网友，也不要让主角像第一次看到自己的发言一样陌生。',
            '4. 论坛昵称是主角在该论坛使用的网名，与角色名字可以不同，但这是主角自己的账号。',
            '5. 【论坛网友】均为其他用户，他们不知道主角的内在想法，除非论坛内容明确透露。',
            '', `帖子标题：${t.title || ''}`,
            `本帖楼主是否为主角本人：${t.isUserThread ? '是' : '否'}`, ''
        ];
        (Array.isArray(t.posts) ? t.posts : []).forEach((p, i) => {
            const isMainCharacter = Boolean(p.isUser || (i === 0 && t.isUserThread));
            const tag = isMainCharacter ? '【主角本人】' : '【论坛网友】';
            const bio = p.authorBio ? `（简介：${p.authorBio}）` : '';
            lines.push(`${i + 1}楼 ${tag} ${p.author || '匿名用户'}${bio}：${p.content || ''}`);
            (Array.isArray(p.replies) ? p.replies : []).forEach((r, ri) => {
                const rTag = r.isUser ? '【主角本人】' : '【论坛网友】';
                const rBio = r.authorBio ? `（简介：${r.authorBio}）` : '';
                lines.push(`  └ 回复${ri + 1} ${rTag} ${r.author || '匿名用户'}${rBio}：${r.content || ''}`);
            });
        });
        lines.push('', '请把上述身份标记视为事实。主角能够认出自己的论坛昵称、自己的帖子以及自己发出的评论。', '【论坛帖子注入结束】');
        return lines.join('\n');
    }

    let injectedThreadId = null;

    function setForumThreadInjection(t) {
        try {
            if (!t) {
                ST.setExtensionPrompt(FORUM_INJECT_PROMPT_ID, '', 1, 0, false, 0);
                injectedThreadId = null;
                return true;
            }
            const content = getThreadInjectionText(t);
            // SillyTavern 原生扩展提示词：IN_CHAT=1，深度0；不修改聊天原文。
            ST.setExtensionPrompt(FORUM_INJECT_PROMPT_ID, content, 1, 0, false, 0);
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
            if (setForumThreadInjection(null)) {
                renderForumList();
                if (currentThreadId === t.id) openThread(t.id);
                showToast('已取消注入');
            }
            return;
        }
        if (setForumThreadInjection(t)) {
            renderForumList();
            if (currentThreadId === t.id) openThread(t.id);
            showToast('已将本帖注入正文');
        }
    }

    function clearForumThreadInjection() {
        try { ST.setExtensionPrompt(FORUM_INJECT_PROMPT_ID, '', 1, 0, false, 0); } catch (_) {}
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

        const names = await nativeGetWorldbookNames();

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
        // Android/Termux: 先显示窗口，任何数据同步异常都不能阻止论坛出现。
        try { panel.classList.add('show'); } catch (_) {}
        try { openView('home'); } catch (_) {}
        try {
            switchChat();
        } catch (_) {
            // 手机端切换聊天失败时，论坛仍保持打开。
        }
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

    // ============================================================
    // 洛托姆按钮：Android 触摸与桌面鼠标分开处理
    // ============================================================
    // Android WebView 会把一次触摸同时派发为 touch 与 pointer 事件。
    // 如果两套逻辑同时处理，容易出现“打开后又被第二个事件关闭/覆盖”。
    // 因此：手指只走 touch*；鼠标只走 pointer*。

    function beginFloatDrag(e) {
        if (!e || e.pointerType !== 'mouse') return;
        if (e.button !== 0) return;

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
        e.stopPropagation();
    }

    function moveFloatDrag(e) {
        if (!dragState || !e || e.pointerType !== 'mouse' || e.pointerId !== dragState.pointerId) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
            floatMoved = true;
            suppressNextOpen = true;
        }

        if (floatMoved) {
            applyFloatPosition(
                dragState.startLeft + dx,
                dragState.startTop + dy
            );
        }

        e.preventDefault();
        e.stopPropagation();
    }

    function finishFloatDrag(e) {
        if (!dragState || !e || e.pointerType !== 'mouse') return;
        if (e.pointerId !== dragState.pointerId) return;

        const moved = floatMoved;
        const pointerId = dragState.pointerId;

        try { floatBtn.releasePointerCapture(pointerId); } catch (_) {}
        floatBtn.classList.remove('dragging');
        saveFloatPosition();

        dragState = null;
        floatMoved = false;

        if (!moved && !suppressNextOpen) {
            openPhone();
        }

        suppressNextOpen = false;
        e.preventDefault();
        e.stopPropagation();
    }

    // Android 手指专用路径：不使用 pointer capture。
    let touchActive = false;
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartLeft = 0;
    let touchStartTop = 0;

    floatBtn.addEventListener('touchstart', e => {
        const t = e.touches && e.touches[0];
        if (!t) return;

        const r = floatBtn.getBoundingClientRect();

        touchActive = true;
        touchMoved = false;
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartLeft = r.left;
        touchStartTop = r.top;

        floatBtn.classList.add('dragging');
        e.stopPropagation();
    }, { passive: true });

    floatBtn.addEventListener('touchmove', e => {
        if (!touchActive) return;

        const t = e.touches && e.touches[0];
        if (!t) return;

        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;

        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            touchMoved = true;
        }

        if (touchMoved) {
            e.preventDefault();
            applyFloatPosition(
                touchStartLeft + dx,
                touchStartTop + dy
            );
        }

        e.stopPropagation();
    }, { passive: false });

    floatBtn.addEventListener('touchend', e => {
        if (!touchActive) return;

        const moved = touchMoved;

        touchActive = false;
        touchMoved = false;
        floatBtn.classList.remove('dragging');

        e.preventDefault();
        e.stopPropagation();

        if (!moved) {
            // 直接打开，不经过 click，也不依赖 pointer 事件。
            openPhone();
        } else {
            saveFloatPosition();
        }
    }, { passive: false });

    floatBtn.addEventListener('touchcancel', e => {
        touchActive = false;
        touchMoved = false;
        floatBtn.classList.remove('dragging');
        e.stopPropagation();
    }, { passive: false });

    // 桌面鼠标路径。
    floatBtn.addEventListener('pointerdown', beginFloatDrag, { passive: false });
    floatBtn.addEventListener('pointermove', moveFloatDrag, { passive: false });
    floatBtn.addEventListener('pointerup', finishFloatDrag, { passive: false });
    floatBtn.addEventListener('pointercancel', finishFloatDrag, { passive: false });

    dragWindow.addEventListener('pointermove', moveFloatDrag, { passive: false });
    dragWindow.addEventListener('pointerup', finishFloatDrag, { passive: false });
    dragWindow.addEventListener('pointercancel', finishFloatDrag, { passive: false });

    // 鼠标点击兜底；触摸事件会 stopPropagation，不会走到这里。
    floatBtn.addEventListener('click', e => {
        if (e.detail === 0) return;
        e.preventDefault();
        e.stopPropagation();
        openPhone();
    }, { passive: false });

    dragWindow.addEventListener('resize', () => {
        const rect = floatBtn.getBoundingClientRect();
        applyFloatPosition(rect.left, rect.top);
        saveFloatPosition();
    });

    const closePhoneBtn = $('pkmn-close-phone');
    if (closePhoneBtn) {
        // 关闭按钮同样只使用 click，避免一次 Android 触摸触发多次 close/open。
        closePhoneBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            closePhone();
        }, { passive: false });
    }

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

    try {
        const on = ST.eventSource?.on?.bind(ST.eventSource);
        if (on) {
            const changedEv = ST_EVENTS.CHAT_CHANGED || 'CHAT_CHANGED';
            const createdEv = ST_EVENTS.CHAT_CREATED || 'CHAT_CREATED';
            on(changedEv, newChatId => {
                setTimeout(() => {
                    const key = newChatId !== undefined && newChatId !== null ? 'chat:' + String(newChatId) : getChatKey();
                    switchChat(key);
                }, 150);
            });
            on(createdEv, newChatId => {
                setTimeout(() => resetForumForNewChat(newChatId), 150);
            });
        }
    } catch (_) {}

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