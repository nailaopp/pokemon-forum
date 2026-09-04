/**
 * 宝可梦小手机论坛 - SillyTavern 扩展版 (v0.41)
 * 基于酒馆助手脚本「测试论坛0.331」完整转换，脱离 Tavern Helper。
 * 使用 SillyTavern.getContext() / setExtensionPrompt / eventSource / loadWorldInfo。
 *
 * 安装：将本文件夹放到
 *   data/<用户名>/extensions/pkmn-phone-forum/
 *   或 public/scripts/extensions/third-party/pkmn-phone-forum/
 * 刷新后在扩展面板启用「宝可梦小手机论坛」。
 */

(function () {
    'use strict';

    function whenReady(fn) {
        let started = false;
        const run = () => {
            if (started) return;
            started = true;
            try { fn(); } catch (e) {
                console.error('[宝可梦小手机论坛] 启动失败:', e && e.stack ? e.stack : e);
                try { if (window.toastr) toastr.error('宝可梦论坛扩展启动失败，请看控制台'); } catch (_) {}
            }
        };
        if (document.body) {
            try {
                const ctx = (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null;
                if (ctx && ctx.eventSource && ctx.eventTypes) {
                    const ev = ctx.eventTypes.APP_READY || 'app_ready';
                    if (typeof ctx.eventSource.once === 'function') ctx.eventSource.once(ev, () => setTimeout(run, 100));
                    else if (typeof ctx.eventSource.on === 'function') ctx.eventSource.on(ev, () => setTimeout(run, 100));
                }
            } catch (_) {}
            setTimeout(run, 800);
            setTimeout(run, 3000);
            return;
        }
        document.addEventListener('DOMContentLoaded', () => setTimeout(run, 500));
        setTimeout(run, 2500);
    }

    whenReady(function startPkmnPhoneForum() {

        const NS = 'pkmn_phone_forum_v9';
    const LEGACY_NS = 'pkmn_phone_forum_v7';
    const LEGACY_NS_2 = 'pkmn_phone_forum_v5';
    const VERSION = 59; // persist contact API independently

    // 必须尽早声明，否则严格模式下赋值会直接启动失败
    let chatState = null;


    // 扩展运行在酒馆主页面，统一使用当前 document，避免跨 iframe 导致桌面端异常
    let topDoc = document;
    try {
        if (window.top && window.top !== window && window.top.document) {
            // 仅当确实在同源 iframe 内时才用 top
            if (window.top.document.body) topDoc = window.top.document;
        }
    } catch (_) {
        topDoc = document;
    }

    // ============================================================
    // 0.39 生命周期管理
    // ============================================================
    const LIFECYCLE_KEY = '__pkmn_phone_forum_v039_lifecycle__';
    try {
        const old = window[LIFECYCLE_KEY];
        if (old && typeof old.destroy === 'function') old.destroy();
    } catch (_) {}

    const lifecycle = {
        timers: new Set(),
        cleanups: new Set(),
        destroyed: false,
        trackTimer(id) { this.timers.add(id); return id; },
        trackCleanup(fn) { if (typeof fn === 'function') this.cleanups.add(fn); return fn; },
        destroy() {
            this.destroyed = true;
            for (const id of Array.from(this.timers)) {
                try { clearInterval(id); } catch (_) {}
                try { clearTimeout(id); } catch (_) {}
            }
            this.timers.clear();
            for (const fn of Array.from(this.cleanups)) {
                try { fn(); } catch (_) {}
            }
            this.cleanups.clear();
        }
    };
    window[LIFECYCLE_KEY] = lifecycle;

    function trackedSetInterval(fn, ms) {
        const id = setInterval(() => {
            if (lifecycle.destroyed) return;
            try { fn(); } catch (_) {}
        }, ms);
        return lifecycle.trackTimer(id);
    }

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
    // Tavern Helper 兼容层
    // ============================================================


    // ============================================================
    // Native SillyTavern adapter (replaces Tavern Helper)
    // ============================================================

    function getSTContext() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                return SillyTavern.getContext();
            }
        } catch (_) {}
        try {
            if (typeof getContext === 'function') return getContext();
        } catch (_) {}
        return null;
    }

    const TH = {
        getChatMessages(range, options) {
            const ctx = getSTContext();
            if (!ctx || !Array.isArray(ctx.chat)) return [];
            const chat = ctx.chat;
            let start = 0, end = chat.length;
            if (typeof range === 'string' && range.startsWith('-')) {
                const n = parseInt(range.slice(1), 10) || 12;
                start = Math.max(0, chat.length - n);
            } else if (typeof range === 'number') {
                start = Math.max(0, range);
                end = Math.min(chat.length, range + 1);
            }
            return chat.slice(start, end).map((m, i) => ({
                name: m.name || (m.is_user ? (ctx.name1 || '玩家') : (ctx.name2 || '角色')),
                role: m.is_user ? 'user' : 'assistant',
                message: m.mes || m.message || m.content || '',
                content: m.mes || m.message || m.content || '',
                mes: m.mes || m.message || m.content || '',
                is_user: !!m.is_user,
                index: start + i
            }));
        },

        getLastMessageId() {
            const ctx = getSTContext();
            if (!ctx || !Array.isArray(ctx.chat)) return -1;
            return ctx.chat.length - 1;
        },

        getWorldbookNames() {
            const names = new Set();
            try {
                const ctx = getSTContext();
                if (ctx && typeof ctx.getWorldInfoNames === 'function') {
                    const list = ctx.getWorldInfoNames();
                    if (Array.isArray(list)) list.forEach(n => n && names.add(String(n)));
                }
            } catch (_) {}
            try {
                const g = (typeof world_names !== 'undefined' && world_names)
                    || (typeof window !== 'undefined' && window.world_names)
                    || null;
                if (Array.isArray(g)) g.forEach(n => n && names.add(String(n)));
            } catch (_) {}
            try {
                document.querySelectorAll('#world_info, select[name="world_info"], #world_info_select, #world_editor_select').forEach(select => {
                    Array.from(select.options || []).forEach(o => {
                        const v = (o.value || o.text || '').trim();
                        if (v && v !== '---' && !/^select/i.test(v)) names.add(v);
                    });
                });
            } catch (_) {}
            return [...names];
        },

        async getWorldbook(name) {
            if (!name) return [];
            const normalizeEntries = (data) => {
                if (!data) return [];
                let list = [];
                if (Array.isArray(data.entries)) list = data.entries;
                else if (data.entries && typeof data.entries === 'object') list = Object.values(data.entries);
                else if (Array.isArray(data)) list = data;
                return list
                    .filter(e => e && (e.content || e.key || e.keys || e.comment))
                    .map(e => {
                        const keys = Array.isArray(e.key) ? e.key
                            : (Array.isArray(e.keys) ? e.keys
                            : (e.key ? [e.key] : []));
                        const secondary = Array.isArray(e.keysecondary) ? e.keysecondary
                            : (Array.isArray(e.secondary_keys) ? e.secondary_keys
                            : (Array.isArray(e.secondaryKeys) ? e.secondaryKeys : []));
                        return {
                            name: e.comment || keys[0] || '条目',
                            comment: e.comment || '',
                            key: keys[0] || '',
                            keys,
                            keywords: keys,
                            secondary_keys: secondary,
                            secondaryKeys: secondary,
                            content: e.content || '',
                            enabled: e.disable ? false : (e.enabled !== false),
                            uid: e.uid
                        };
                    });
            };
            try {
                const ctx = getSTContext();
                if (ctx && typeof ctx.loadWorldInfo === 'function') {
                    const data = await ctx.loadWorldInfo(name);
                    const entries = normalizeEntries(data);
                    if (entries.length) return entries;
                }
            } catch (err) {
                console.warn('[pkmn-forum] ctx.loadWorldInfo failed', err);
            }
            try {
                const mod = await import(/* webpackIgnore: true */ '/scripts/world-info.js');
                if (mod && typeof mod.loadWorldInfo === 'function') {
                    const data = await mod.loadWorldInfo(name);
                    const entries = normalizeEntries(data);
                    if (entries.length) return entries;
                }
            } catch (err) {
                console.warn('[pkmn-forum] import loadWorldInfo failed', err);
            }
            try {
                const ctx = getSTContext();
                const headers = (ctx && typeof ctx.getRequestHeaders === 'function')
                    ? ctx.getRequestHeaders()
                    : { 'Content-Type': 'application/json' };
                const res = await fetch('/api/worldinfo/get', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const data = await res.json();
                    return normalizeEntries(data);
                }
            } catch (err) {
                console.warn('[pkmn-forum] /api/worldinfo/get failed', err);
            }
            return [];
        },

        getCharacterName() {
            const ctx = getSTContext();
            if (!ctx) return '';
            return ctx.name2 || (ctx.characters && ctx.characterId != null && ctx.characters[ctx.characterId]?.name) || '';
        },

        getVariables() {
            const ctx = getSTContext();
            return ctx?.variables || {};
        },

        eventOn(eventName, callback) {
            const ctx = getSTContext();
            if (!ctx || !ctx.eventSource || typeof callback !== 'function') return;
            const types = ctx.eventTypes || {};
            const map = {
                'CHAT_CHANGED': types.CHAT_CHANGED || 'chat_changed',
                'chat_changed': types.CHAT_CHANGED || 'chat_changed',
                'CHAT_CREATED': types.CHAT_CREATED || types.CHAT_CHANGED || 'chat_created',
                'chat_created': types.CHAT_CREATED || types.CHAT_CHANGED || 'chat_created',
                'MESSAGE_RECEIVED': types.MESSAGE_RECEIVED || 'message_received',
                'MESSAGE_SENT': types.MESSAGE_SENT || 'message_sent',
            };
            const ev = map[eventName] || types[eventName] || eventName;
            try {
                ctx.eventSource.on(ev, callback);
                if ((eventName === 'CHAT_CREATED' || eventName === 'chat_created') && types.CHAT_CHANGED && ev !== types.CHAT_CHANGED) {
                    ctx.eventSource.on(types.CHAT_CHANGED, callback);
                }
            } catch (e) {
                console.warn('[pkmn-forum] eventOn failed', eventName, e);
            }
        },

        injectPrompts(prompts, options) {
            const ctx = getSTContext();
            if (!ctx || typeof ctx.setExtensionPrompt !== 'function') {
                throw new Error('当前 SillyTavern 不支持 setExtensionPrompt');
            }
            const uninjectFns = [];
            for (const p of (prompts || [])) {
                const key = p.id || 'pkmn_forum_inject';
                // extension_prompt_types: IN_PROMPT=0, IN_CHAT=1, BEFORE_PROMPT=2
                let pos = 1;
                if (p.position === 'in_chat') pos = 1;
                else if (p.position === 'in_prompt' || p.position === 'after') pos = 0;
                else if (p.position === 'before') pos = 2;
                else if (typeof p.position === 'number') pos = p.position;
                const depth = typeof p.depth === 'number' ? p.depth : 0;
                const scan = !!p.should_scan;
                let role = p.role || 'system';
                const roleMap = { system: 0, user: 1, assistant: 2 };
                const roleValue = (typeof role === 'string' && role in roleMap) ? roleMap[role] : role;
                try {
                    ctx.setExtensionPrompt(key, p.content || '', pos, depth, scan, roleValue);
                } catch (e1) {
                    try {
                        ctx.setExtensionPrompt(key, p.content || '', pos, depth, scan, role);
                    } catch (e2) {
                        ctx.setExtensionPrompt(key, p.content || '', pos, depth, scan);
                    }
                }
                uninjectFns.push(() => {
                    try { ctx.setExtensionPrompt(key, ''); } catch (_) {}
                });
            }
            return {
                uninject: () => uninjectFns.forEach(fn => { try { fn(); } catch (_) {} })
            };
        },

        uninjectPrompts(ids) {
            const ctx = getSTContext();
            if (!ctx || typeof ctx.setExtensionPrompt !== 'function') return;
            (ids || []).forEach(id => {
                try { ctx.setExtensionPrompt(id, ''); } catch (_) {}
            });
        },

        updateChatMetadata(data, replace) {
            const ctx = getSTContext();
            if (!ctx) return;
            try {
                if (typeof ctx.updateChatMetadata === 'function') {
                    ctx.updateChatMetadata(data || {}, !!replace);
                    return;
                }
            } catch (e) {
                console.warn('[pkmn-forum] updateChatMetadata failed', e);
            }
            try {
                if (!ctx.chatMetadata) ctx.chatMetadata = {};
                Object.keys(data || {}).forEach(k => { ctx.chatMetadata[k] = data[k]; });
            } catch (_) {}
        },

        saveChat() {
            const ctx = getSTContext();
            if (!ctx) return Promise.resolve();
            try {
                if (typeof ctx.saveChat === 'function') return Promise.resolve(ctx.saveChat());
                if (typeof ctx.saveMetadataDebounced === 'function') {
                    ctx.saveMetadataDebounced();
                    return Promise.resolve();
                }
                if (typeof ctx.saveMetadata === 'function') return Promise.resolve(ctx.saveMetadata());
            } catch (_) {}
            return Promise.resolve();
        }
    };

    window.__pkmn_forum_TH = TH;

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
            MATURE_BOARDS.map(x => ({ ...x })),

        // 独立通讯录/微信式聊天配置
        contacts: [],
        contactChats: {},
        contactLinkMeta: {},
        contactPlayerNickname: '',
        contactPlayerIdentity: '',
        // 通讯录按 SillyTavern 当前角色卡聊天独立保存：新聊天为空，旧聊天恢复。
        contactChatArchives: {},
        contactChatArchivesVersion: 1,
        contactApi: {
            endpoint: '',
            key: '',
            model: '',
            temperature: 0.85,
            maxTokens: 900,
            systemPrompt: '你正在模拟宝可梦世界中的通讯软件聊天。请严格按照联系人本人的身份、性格、经历、当前所在地和当前剧情进行回复。你不是旁白，不要替玩家决定行动。回复要像真实微信消息一样自然、简洁、有来有回。除非剧情需要，不要使用舞台说明、JSON或长篇旁白。',
            readForumAll: true
        }
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

            c.contactApi = Object.assign(
                clone(DEFAULT_CONFIG.contactApi),
                c.contactApi || {}
            );
            try {
                const rawContactApi = localStorage.getItem(NS + '_contact_api');
                if (rawContactApi) {
                    const savedContactApi = JSON.parse(rawContactApi);
                    if (savedContactApi && typeof savedContactApi === 'object') {
                        c.contactApi = Object.assign(c.contactApi, savedContactApi);
                    }
                }
            } catch (_) {}

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
            const ctx = getSTContext();
            if (ctx) {
                if (typeof ctx.getCurrentChatId === 'function') {
                    const id = ctx.getCurrentChatId();
                    if (id !== undefined && id !== null && String(id) !== '') {
                        return 'chat:' + String(id);
                    }
                }
                if (ctx.chatId !== undefined && ctx.chatId !== null && String(ctx.chatId) !== '') {
                    return 'chat:' + String(ctx.chatId);
                }
            }
        } catch (_) {}
        try {
            const st = window.SillyTavern || window.parent?.SillyTavern;
            if (st && typeof st.getCurrentChatId === 'function') {
                const id = st.getCurrentChatId();
                if (id !== undefined && id !== null && String(id) !== '') {
                    return 'chat:' + String(id);
                }
            }
        } catch (_) {}
        try {
            if (typeof getCurrentChatId === 'function') {
                const id = getCurrentChatId();
                if (id !== undefined && id !== null && String(id) !== '') {
                    return 'chat:' + String(id);
                }
            }
        } catch (_) {}
        try {
            const ctx = getSTContext();
            const char = (ctx && (ctx.name2 || ctx.characters?.[ctx.characterId]?.name)) ||
                (TH.getCharacterName ? TH.getCharacterName() : '') || '';
            let first = '';
            if (ctx && Array.isArray(ctx.chat) && ctx.chat[0]) {
                first = ctx.chat[0].mes || ctx.chat[0].message || '';
            } else if (TH.getChatMessages) {
                const a = TH.getChatMessages(0);
                if (a && a[0]) first = a[0].message || a[0].content || a[0].mes || '';
            }
            if (!first) {
                const el = topDoc.querySelector('.mes_text');
                if (el) first = el.innerText || '';
            }
            const cid = (ctx && ctx.characterId != null) ? String(ctx.characterId) : '';
            return 'fallback:' + simpleHash(String(char) + '|' + cid + '|' + first);
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


    function storageKey(key) {
        return NS + '_chat_' + simpleHash(String(key || ''));
    }

    function storageKeyRaw(key) {
        // 第二套 key：不哈希，避免哈希碰撞/不一致；超长则仍用哈希
        const s = String(key || '');
        if (s.length <= 180) return NS + '_raw_' + s;
        return storageKey(s);
    }

    const ARCHIVE_INDEX_KEY = NS + '_archive_index_v1';

    function updateArchiveIndex(key, state) {
        try {
            let index = {};
            try { index = JSON.parse(localStorage.getItem(ARCHIVE_INDEX_KEY) || '{}') || {}; } catch (_) {}
            index[String(key)] = {
                n: threadCount(state),
                t: Number(state && state.updatedAt) || Date.now(),
                h: simpleHash(String(key))
            };
            localStorage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify(index));
        } catch (_) {}
    }

    function threadCount(state) {
        if (!state) return 0;
        return (Array.isArray(state.safeThreads) ? state.safeThreads.length : 0)
            + (Array.isArray(state.matureThreads) ? state.matureThreads.length : 0);
    }

    // 进程内备份
    const archiveMemory = new Map();
    let lastChatKey = null;

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

    function rememberArchive(key, state) {
        if (!key || key === 'fallback:unknown' || !state) return;
        try { archiveMemory.set(String(key), clone(state)); } catch (_) {}
    }

    function normalizeLoadedState(s, key) {
        if (!s || typeof s !== 'object') s = makeChatState();
        s.chatKey = key;
        s.safeThreads = Array.isArray(s.safeThreads) ? s.safeThreads : [];
        s.matureThreads = Array.isArray(s.matureThreads) ? s.matureThreads : [];
        s.counters = s.counters || {};
        s.lastRefresh = s.lastRefresh || {};
        normalizeForumState(s);
        return s;
    }

    // 只写本地（切聊天保存旧档专用；绝不碰当前 metadata）
    function persistLocalOnly(key, state) {
        if (!key || key === 'fallback:unknown' || !state) return false;
        try {
            const s = normalizeLoadedState(clone(state), key);
            s.updatedAt = Date.now();
            // 保护：不要用空档覆盖已有非空档
            const existing = readLocalRaw(key);
            if (existing && threadCount(existing) > 0 && threadCount(s) === 0) {
                console.warn('[pkmn-forum] refuse to overwrite non-empty archive with empty', key);
                rememberArchive(key, existing);
                return false;
            }
            const payload = JSON.stringify(s);
            localStorage.setItem(storageKey(key), payload);
            try { localStorage.setItem(storageKeyRaw(key), payload); } catch (_) {}
            rememberArchive(key, s);
            updateArchiveIndex(key, s);
            console.log('[pkmn-forum] persisted', key, 'threads', threadCount(s));
            return true;
        } catch (e) {
            console.warn('[pkmn-forum] persistLocalOnly failed', e);
            try { rememberArchive(key, state); } catch (_) {}
            return false;
        }
    }

    function readLocalRaw(key) {
        if (!key) return null;
        const tryParse = (raw) => {
            if (!raw) return null;
            try {
                return normalizeLoadedState(JSON.parse(raw), key);
            } catch (_) { return null; }
        };
        let s = tryParse(localStorage.getItem(storageKey(key)));
        if (s) return s;
        s = tryParse(localStorage.getItem(storageKeyRaw(key)));
        if (s) return s;
        s = tryParse(localStorage.getItem(LEGACY_NS + '_chat_' + simpleHash(key)));
        if (s) return s;
        s = tryParse(localStorage.getItem(LEGACY_NS_2 + '_chat_' + simpleHash(key)));
        if (s) return s;
        if (archiveMemory.has(String(key))) {
            try { return normalizeLoadedState(clone(archiveMemory.get(String(key))), key); } catch (_) {}
        }
        return null;
    }

    function loadChatState(key) {
        const s = readLocalRaw(key);
        if (s) {
            rememberArchive(key, s);
            return s;
        }
        return normalizeLoadedState(makeChatState(), key);
    }

    function saveChatState() {
        try {
            const live = getChatKey();
            if (live && live !== 'fallback:unknown') {
                if (chatState.chatKey && chatState.chatKey !== live && chatState.chatKey !== 'fallback:unknown') {
                    persistLocalOnly(chatState.chatKey, chatState);
                }
                chatState.chatKey = live;
            }
        } catch (_) {}
        chatState.updatedAt = Date.now();
        persistLocalOnly(chatState.chatKey, chatState);

        // metadata 仅当 key 与当前 live 一致
        try {
            const live = getChatKey();
            if (live && live !== chatState.chatKey) return;
            if (TH.updateChatMetadata) {
                TH.updateChatMetadata({ [NS]: clone(chatState) }, false);
            }
            try {
                const meta = getChatMetadataObject();
                if (meta) meta[NS] = clone(chatState);
            } catch (_) {}
            if (TH.saveChat) Promise.resolve(TH.saveChat()).catch(() => {});
            try {
                const ctx = getSTContext();
                if (ctx) {
                    if (typeof ctx.saveMetadataDebounced === 'function') ctx.saveMetadataDebounced();
                    else if (typeof ctx.saveMetadata === 'function') ctx.saveMetadata();
                }
            } catch (_) {}
        } catch (e) {
            console.warn('[pkmn-forum] metadata save failed', e);
        }
    }

    function getChatMetadataObject() {
        try {
            const ctx = getSTContext();
            if (ctx && ctx.chatMetadata && typeof ctx.chatMetadata === 'object') return ctx.chatMetadata;
        } catch (_) {}
        try {
            const st = window.SillyTavern || window.parent?.SillyTavern;
            if (st && st.chatMetadata) return st.chatMetadata;
        } catch (_) {}
        try { if (typeof chat_metadata !== 'undefined' && chat_metadata) return chat_metadata; } catch (_) {}
        try { if (typeof chatMetadata !== 'undefined' && chatMetadata) return chatMetadata; } catch (_) {}
        return null;
    }

    function loadFromChatMetadata(expectedKey = null) {
        try {
            const metadata = getChatMetadataObject();
            if (!metadata || !metadata[NS]) return false;
            const s = metadata[NS];
            if (!s || typeof s !== 'object') return false;
            const currentKey = expectedKey || getChatKey();
            if (s.chatKey && currentKey && s.chatKey !== currentKey) return false;

            const fromMeta = normalizeLoadedState(clone(s), currentKey);
            const fromLocal = readLocalRaw(currentKey);

            let chosen = fromMeta;
            if (fromLocal) {
                const metaN = threadCount(fromMeta);
                const localN = threadCount(fromLocal);
                const metaT = Number(fromMeta.updatedAt) || 0;
                const localT = Number(fromLocal.updatedAt) || 0;
                if (localN > metaN || (localN >= metaN && localT >= metaT)) {
                    chosen = fromLocal;
                }
                if (metaN === 0 && localN > 0) chosen = fromLocal;
            }
            // 禁止用空 metadata 覆盖非空内存
            if (threadCount(chosen) === 0 && threadCount(chatState) > 0 && chatState.chatKey === currentKey) {
                return false;
            }
            chatState = chosen;
            persistLocalOnly(currentKey, chatState);
            return true;
        } catch (e) {
            console.warn('[pkmn-forum] loadFromChatMetadata failed', e);
            return false;
        }
    }

    // ============================================================
    // 切换聊天：先保存旧档，再加载新档
    // ============================================================

    function switchChat(forcedKey = null, silent = false) {
        const key = forcedKey || getChatKey();
        if (!key || key === 'fallback:unknown') {
            console.warn('[pkmn-forum] switchChat: invalid key', key);
            return;
        }

        try { switchContactChat(key, { silent: true }); } catch (e) { console.warn('[pkmn-forum] contact chat switch failed', e); }

        if (key === chatState.chatKey) {
            try {
                const local = readLocalRaw(key);
                if (local && threadCount(local) > threadCount(chatState)) {
                    chatState = local;
                }
                loadFromChatMetadata(key);
            } catch (_) {}
            normalizeForumState(chatState);
            currentThreadId = null;
            try { clearForumThreadInjection(); } catch (_) {}
            renderForumList();
            return;
        }

        const oldKey = chatState.chatKey;
        const oldThreads = threadCount(chatState);
        console.log('[pkmn-forum] switchChat', oldKey, '=>', key, 'oldThreads', oldThreads);

        // 1) 无条件保存旧档到内存 + localStorage
        if (oldKey && oldKey !== 'fallback:unknown') {
            persistLocalOnly(oldKey, chatState);
        } else if (oldThreads > 0) {
            // oldKey 无效但有帖子：用 lastChatKey 再试一次
            if (lastChatKey && lastChatKey !== 'fallback:unknown') {
                persistLocalOnly(lastChatKey, chatState);
            }
        }

        // 2) 加载新档
        let next = readLocalRaw(key);
        if (!next) next = normalizeLoadedState(makeChatState(), key);
        chatState = next;
        chatState.chatKey = key;

        try { loadFromChatMetadata(key); } catch (_) {}
        chatState.chatKey = key;
        normalizeForumState(chatState);

        console.log('[pkmn-forum] loaded', key, 'threads', threadCount(chatState));
        rememberArchive(key, chatState);
        lastChatKey = key;

        currentThreadId = null;
        try { clearForumThreadInjection(); } catch (_) {}
        renderForumList();
        if (!silent) {
            showToast(threadCount(chatState) > 0
                ? `已加载本聊天论坛（${threadCount(chatState)} 帖）`
                : '已切换到当前聊天的论坛存档');
        }
    }

    function resetForumForNewChat(newChatId = null) {
        const key =
            newChatId !== null && newChatId !== undefined
                ? 'chat:' + String(newChatId)
                : getChatKey();

        // 先保存当前内存到旧 key
        if (chatState.chatKey && chatState.chatKey !== key && chatState.chatKey !== 'fallback:unknown') {
            persistLocalOnly(chatState.chatKey, chatState);
        }

        // 若目标 key 已有内容，恢复而不是清空
        const existing = readLocalRaw(key);
        if (existing && threadCount(existing) > 0) {
            console.log('[pkmn-forum] newChat skipped, restore existing', key, threadCount(existing));
            chatState = existing;
            chatState.chatKey = key;
            normalizeForumState(chatState);
            currentThreadId = null;
            try { clearForumThreadInjection(); } catch (_) {}
            lastChatKey = key;
            renderForumList();
            return;
        }

        chatState = normalizeLoadedState(makeChatState(), key);
        chatState.safeThreads = [];
        chatState.matureThreads = [];
        chatState.counters = {};
        chatState.lastRefresh = {};
        // 空档也写入，但不覆盖非空（persistLocalOnly 已保护）
        persistLocalOnly(key, chatState);
        clearForumThreadInjection();
        currentThreadId = null;
        lastChatKey = key;
        renderForumList();
        showToast('新聊天：论坛已清空');
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

            if (TH.getChatMessages) {

                const msgs =
                    TH.getChatMessages(
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
        if (!config.worldbooks.length || !TH.getWorldbook) return [];

        const keywords = extractContextKeywords(chatText);
        const all = [];

        for (const name of config.worldbooks) {
            try {
                const entries = await TH.getWorldbook(name);
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

    // Styles loaded via extension style.css (manifest)



    // ============================================================
    // 手机按钮
    // ============================================================

    const floatBtn =
        topDoc.createElement(
            'button'
        );

    floatBtn.id =
        'pkmn-float-btn';
    floatBtn.type = 'button';
    floatBtn.setAttribute('aria-label', '宝可梦论坛');
    floatBtn.tabIndex = 0;
    // 确保桌面端可点可拖，不被其它层样式误伤
    floatBtn.style.setProperty('pointer-events', 'auto', 'important');
    floatBtn.style.setProperty('z-index', '2147483646', 'important');

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

<div class="pkmn-drag-top" id="pkmn-drag-top" aria-label="拖动手机"></div>

<div class="pkmn-status">
    <span id="pkmn-time">00:00</span>
    <div class="pkmn-status-right">
        <span class="pkmn-status-icons" aria-hidden="true"><i class="pkmn-signal" aria-hidden="true"></i><i class="pkmn-wifi" aria-hidden="true"></i><i class="pkmn-battery" aria-hidden="true"></i></span>
        <button id="pkmn-phone-scale" type="button" aria-label="切换手机大小">↕</button>
    </div>
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
                <div class="pkmn-app-image"><img src="data:image/jpeg;base64,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" alt=""></div>
                宝可萌大师
            </div>

            <div
                class="pkmn-app-icon"
                id="pkmn-open-mature"
            >
                <div class="pkmn-app-image"><img src="data:image/png;base64,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" alt=""></div>
                91宝可梦论坛
            </div>

            <div class="pkmn-app-icon pkmn-contacts-icon" id="pkmn-open-contacts">
                <div class="pkmn-app-image wechat-app-logo">💬</div>
                通讯录
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
                表论坛
            </span>

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
            <button id="pkmn-settings-back">‹</button>
            <span>论坛设置</span>
        </div>

        <div class="pkmn-settings" id="pkmn-settings-body"></div>

    </div>

    <!-- 通讯录 -->
    <div id="pkmn-contacts" class="pkmn-view pkmn-chat-app">
        <div class="wechat-nav">
            <button id="pkmn-contacts-back">‹</button>
            <div class="wechat-nav-title">通讯录</div>
            <button id="pkmn-contacts-add">＋</button>
        </div>
        <div class="wechat-search"><span>⌕</span><input id="pkmn-contact-search" placeholder="搜索"></div>
        <div class="wechat-contact-list" id="pkmn-contact-list"></div>
        <div class="wechat-bottom-nav">
            <button class="active">👤<small>通讯录</small></button>
            <button id="pkmn-contact-settings">⚙️<small>设置</small></button>
        </div>
    </div>

    <!-- 微信式聊天 -->
    <div id="pkmn-chat" class="pkmn-view pkmn-chat-app">
        <div class="wechat-nav">
            <button id="pkmn-chat-back">‹</button>
            <div class="wechat-nav-title" id="pkmn-chat-title">聊天</div>
            <button id="pkmn-chat-more">⋯</button>
        </div>
        <div class="wechat-messages" id="pkmn-chat-messages"></div>
        <div class="wechat-inputbar">
            <button type="button">＋</button>
            <textarea id="pkmn-chat-input" rows="1" placeholder="输入消息"></textarea>
            <button class="wechat-send" id="pkmn-chat-send">发送</button>
        </div>
    </div>

    <!-- 通讯录独立设置 -->
    <div id="pkmn-contact-settings-view" class="pkmn-view">
        <div class="pkmn-head">
            <button id="pkmn-contact-settings-back">‹</button>
            <span>通讯录设置</span>
        </div>
        <div class="pkmn-settings" id="pkmn-contact-settings-body"></div>
    </div>

    <!-- 单联系人设置 -->
    <div id="pkmn-contact-person-settings-view" class="pkmn-view">
        <div class="pkmn-head">
            <button id="pkmn-contact-person-settings-back">‹</button>
            <span>聊天设置</span>
        </div>
        <div class="pkmn-settings" id="pkmn-contact-person-settings-body"></div>
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
    const statusBar = panel.querySelector('.pkmn-status');
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

    const PHONE_FULL_HEIGHT = 1360;
    const PHONE_HALF_HEIGHT = 680;
    // v0.51：手机窗口始终以可视视口为基准，避免酒馆滚动容器/浏览器地址栏造成跑位。
    const PHONE_VIEW_MARGIN = 8;
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
        // PC端保持小巧APP窗口，不跟随桌面宽度放大；手机端保持原自适应逻辑
        const width = vp.width >= 768
            ? 390
            : Math.min(620, Math.max(320, vp.width - 24));
        const maxH = Math.max(260, vp.height - PHONE_VIEW_MARGIN * 2);
        const full = Math.min(PHONE_FULL_HEIGHT, maxH);
        const half = Math.min(PHONE_HALF_HEIGHT, Math.max(220, Math.floor(full / 2)));
        return { width, full, half };
    }

    function clampPhonePosition(left, top) {
        const vp = phoneViewport();
        const rect = panel.getBoundingClientRect();
        const w = rect.width || phoneSize().width;
        const h = rect.height || (phoneExpanded ? phoneSize().full : phoneSize().half);
        const margin = PHONE_VIEW_MARGIN;
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

    // 将手机窗口复位到屏幕正中央（电脑 / 手机通用，基于当前视口）
    function resetPhoneToCenter() {
        try {
            centerPhoneInitial();
            // 确保可见
            panel.classList.add('show');
            try { openView('home'); } catch (_) {}
            showToast('手机窗口已复位到屏幕中央');
        } catch (e) {
            console.warn('[pkmn-forum] resetPhoneToCenter failed', e);
        }
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
            if (scaleBtn && scaleBtn.contains(e.target)) return;
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
            if (scaleBtn && scaleBtn.contains(e.target)) return;
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
            if (scaleBtn && scaleBtn.contains(e.target)) return;
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

    // 顶部整块状态栏都作为拖动区域，避免透明拖动层在 Android WebView 中
    // 被状态栏/刘海层吞掉触摸事件。关闭按钮与缩放按钮自身仍会拦截点击。
    bindPhoneDragHandle(dragTop);
    bindPhoneDragHandle(statusBar);
    bindPhoneDragHandle(dragBottom);

    // 手指离开手柄后仍继续接收移动：直接监听顶层 window/document。
    const phoneDragWin = (topDoc && topDoc.defaultView) || window;
    const phoneDragTarget = (phoneDragWin && typeof phoneDragWin.addEventListener === 'function')
        ? phoneDragWin
        : window;
    phoneDragTarget.addEventListener('touchmove', e => {
        if (!phoneDragState.active || !e.touches) return;
        let t = null;
        for (const item of e.touches) {
            if (item.identifier === phoneDragState.touchId) { t = item; break; }
        }
        if (t) movePhoneDrag(t.clientX, t.clientY, e);
    }, { passive: false, capture: true });
    phoneDragTarget.addEventListener('touchend', endPhoneDrag, { passive: false, capture: true });
    phoneDragTarget.addEventListener('touchcancel', endPhoneDrag, { passive: false, capture: true });
    phoneDragTarget.addEventListener('pointermove', e => {
        if (!phoneDragState.active || e.pointerType === 'touch') return;
        movePhoneDrag(e.clientX, e.clientY, e);
    }, { passive: false, capture: true });
    phoneDragTarget.addEventListener('pointerup', endPhoneDrag, { passive: false, capture: true });
    phoneDragTarget.addEventListener('pointercancel', endPhoneDrag, { passive: false, capture: true });
    phoneDragTarget.addEventListener('mousemove', e => {
        if (phoneDragState.active) movePhoneDrag(e.clientX, e.clientY, e);
    }, { passive: false, capture: true });
    phoneDragTarget.addEventListener('mouseup', endPhoneDrag, { passive: false, capture: true });

    if (scaleBtn) {
        // 只绑定 click。Android WebView 会把一次触摸同时转换成
        // touch/pointer/mouse/click；同时绑定多个事件会连续切换数次，
        // 表现为“点击没有变化”。
        scaleBtn.addEventListener('click', togglePhoneSize, { passive: false });
    }

    // 打开/初始化后强制保证手机在当前可视区内。
    centerPhoneInitial();
    phoneDragTarget.addEventListener('resize', resizePhonePreservePosition, { passive: true });

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

    // 当前注入到酒馆正文的论坛帖子（支持多选）。只作用于后续AI生成，不修改聊天原文。
    // 使用 Set 保存 thread id；实际注入内容为多帖合并后的一段 extension prompt。
    let injectedThreadIds = new Set();

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

        // Keep all secondary views off-screen by default.  Inline transforms
        // intentionally override the stylesheet default (no !important),
        // so navigation can still bring the selected view to 0 without blanking it.
        const positions = {
            home: which === 'home' ? 'translate3d(0,0,0)' : 'translate3d(-100%,0,0)',
            forum: which === 'forum' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
            thread: which === 'thread' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
            settings: which === 'settings' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
            contacts: which === 'contacts' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
            chat: which === 'chat' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
            contactSettings: which === 'contactSettings' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
            contactPersonSettings: which === 'contactPersonSettings' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)'
        };

        home.style.transform = positions.home;
        forum.style.transform = positions.forum;
        thread.style.transform = positions.thread;
        settings.style.transform = positions.settings;

        const contacts = $('pkmn-contacts');
        const chat = $('pkmn-chat');
        const contactSettings = $('pkmn-contact-settings-view');
        const contactPersonSettings = $('pkmn-contact-person-settings-view');
        if (contacts) contacts.style.transform = positions.contacts;
        if (chat) chat.style.transform = positions.chat;
        if (contactSettings) contactSettings.style.transform = positions.contactSettings;
        if (contactPersonSettings) contactPersonSettings.style.transform = positions.contactPersonSettings;
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
                currentForum === 'mature' ? '里论坛' : '表论坛';
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
    // 论坛帖子 -> 酒馆正文提示词注入（支持同时注入多个帖子）
    // ============================================================

    const FORUM_INJECT_PROMPT_ID = 'pkmn-forum-thread-injection';

    function isThreadInjected(id) {
        return !!(id && injectedThreadIds.has(id));
    }

    function findThreadById(id) {
        if (!id) return null;
        const pools = [chatState.safeThreads, chatState.matureThreads];
        for (const arr of pools) {
            if (!Array.isArray(arr)) continue;
            const t = arr.find(x => x && x.id === id);
            if (t) return t;
        }
        return null;
    }

    function getInjectedThreads() {
        const list = [];
        for (const id of injectedThreadIds) {
            const t = findThreadById(id);
            if (t) list.push(t);
            else injectedThreadIds.delete(id); // 帖子已删则丢掉
        }
        return list;
    }

    function getSingleThreadInjectionBody(t, index, total) {
        if (!t) return '';
        const profile = currentUserProfile();
        const forumNick = profile.nickname || '匿名用户';
        const forumName = (t._forum === 'mature' || (currentForum === 'mature' && threads().some(x => x.id === t.id)))
            ? '91宝可梦论坛'
            : (findThreadById(t.id) && chatState.matureThreads.some(x => x && x.id === t.id)
                ? '91宝可梦论坛'
                : '宝可萌大师');
        // 更稳：看帖子实际所在数组
        let forumLabel = '宝可萌大师';
        if (Array.isArray(chatState.matureThreads) && chatState.matureThreads.some(x => x && x.id === t.id)) {
            forumLabel = '91宝可梦论坛';
        }
        const boardName = (() => {
            const allBoards = [...(config.safeBoards || []), ...(config.matureBoards || [])];
            const b = allBoards.find(x => x.id === t.board);
            return b?.name || t.board || '未知板块';
        })();

        const lines = [
            `—— 注入帖子 ${index}/${total} ——`,
            `论坛：${forumLabel}`,
            `板块：${boardName}`,
            `帖子标题：${t.title || ''}`,
            `帖子标签：${threadTags(t).map(x => '#' + x).join(' ')}`,
            `本帖楼主是否为主角本人：${t.isUserThread ? '是' : '否'}`,
            ''
        ];

        (Array.isArray(t.posts) ? t.posts : []).forEach((p, i) => {
            const isMainCharacter = Boolean(p.isUser || (i === 0 && t.isUserThread));
            const tag = isMainCharacter ? '【主角本人】' : '【论坛网友】';
            const bio = p.authorBio ? `（简介：${p.authorBio}）` : '';
            const ip = p.ipLocation || p.location || '关都 · 真新镇';
            lines.push(`${i + 1}楼 ${tag} ${p.author || '匿名用户'}（IP属地：${ip}）${bio}：${p.content || ''}`);
            const nested = Array.isArray(p.replies) ? p.replies : [];
            nested.forEach((r, ri) => {
                const rTag = r.isUser ? '【主角本人】' : '【论坛网友】';
                const rBio = r.authorBio ? `（简介：${r.authorBio}）` : '';
                const rip = r.ipLocation || r.location || '关都 · 真新镇';
                lines.push(`  └ 回复${ri + 1} ${rTag} ${r.author || '匿名用户'}（IP属地：${rip}）${rBio}：${r.content || ''}`);
            });
        });
        return lines.join('\n');
    }

    function getMultiThreadInjectionText(threadList) {
        const profile = currentUserProfile();
        const forumNick = profile.nickname || '匿名用户';
        const list = Array.isArray(threadList) ? threadList.filter(Boolean) : [];
        if (!list.length) return '';

        const header = [
            '【论坛帖子注入 · 多帖合并】',
            '以下内容作为【论坛正文资料】注入当前酒馆正文上下文，仅供当前回复参考；它不是聊天历史原文，也不要把它伪装成已经发生在正文里的剧情。',
            `共注入 ${list.length} 个帖子。`,
            `当前聊天主角的论坛昵称：${forumNick}`,
            `当前聊天主角的论坛简介：${profile.bio || '未设置'}`,
            '',
            '【非常重要的身份规则】',
            '1. 当前聊天中的主角/玩家，就是下面标记为【主角本人】的论坛用户。',
            '2. 【主角本人】发布的帖子或评论，是主角自己亲手发出的内容；主角知道这些内容是自己说过/发过的。',
            '3. 不要把【主角本人】的帖子或评论误认为其他网友，也不要让主角像第一次看到自己的发言一样陌生。',
            '4. 论坛昵称是主角在该论坛使用的网名，与角色名字可以不同，但这是主角自己的账号。',
            '5. 【论坛网友】均为其他用户，他们不知道主角的内在想法，除非论坛内容明确透露。',
            '6. 多个帖子之间相互独立，不要把不同帖子的内容混成同一条剧情时间线，除非帖子本身有关联。',
            ''
        ];

        const bodies = list.map((t, i) => getSingleThreadInjectionBody(t, i + 1, list.length));
        const footer = [
            '',
            '请把上述身份标记视为事实。主角能够认出自己的论坛昵称、自己的帖子以及自己发出的评论。',
            '【论坛帖子注入结束】'
        ];
        return [...header, ...bodies, ...footer].join('\n');
    }

    // 兼容旧调用名
    function getThreadInjectionText(t) {
        return getMultiThreadInjectionText(t ? [t] : []);
    }

    let forumInjectionUninject = null;

    async function applyForumInjections() {
        if (!TH.injectPrompts) {
            showToast('当前 SillyTavern 不支持 setExtensionPrompt，无法注入帖子');
            return false;
        }
        try {
            // 先清掉旧的合并注入
            if (typeof forumInjectionUninject === 'function') {
                try { forumInjectionUninject(); } catch (_) {}
                forumInjectionUninject = null;
            }
            if (TH.uninjectPrompts) {
                try { TH.uninjectPrompts([FORUM_INJECT_PROMPT_ID]); } catch (_) {}
            }

            const list = getInjectedThreads();
            if (!list.length) {
                return true;
            }

            const content = getMultiThreadInjectionText(list);
            const result = TH.injectPrompts(
                [{
                    id: FORUM_INJECT_PROMPT_ID,
                    position: 'in_chat',
                    depth: 0,
                    role: 'user',
                    content,
                    should_scan: false
                }],
                { once: false }
            );

            if (result && typeof result.uninject === 'function') {
                forumInjectionUninject = result.uninject;
            } else if (typeof result === 'function') {
                forumInjectionUninject = result;
            }
            return true;
        } catch (e) {
            showToast('注入失败：' + (e?.message || e));
            return false;
        }
    }

    // 兼容旧 API：setForumThreadInjection(t) / null
    async function setForumThreadInjection(t) {
        if (!t) {
            injectedThreadIds.clear();
            return applyForumInjections();
        }
        injectedThreadIds.add(t.id);
        return applyForumInjections();
    }

    async function toggleForumThreadInjection(t) {
        if (!t) return;

        if (injectedThreadIds.has(t.id)) {
            injectedThreadIds.delete(t.id);
            const ok = await applyForumInjections();
            if (ok) {
                renderForumList();
                if (currentThreadId === t.id) openThread(t.id);
                const n = injectedThreadIds.size;
                showToast(n ? `已取消本帖注入（仍注入 ${n} 帖）` : '已取消全部注入');
            }
            return;
        }

        injectedThreadIds.add(t.id);
        const ok = await applyForumInjections();
        if (ok) {
            renderForumList();
            if (currentThreadId === t.id) openThread(t.id);
            showToast(`已注入本帖（当前共 ${injectedThreadIds.size} 帖）`);
        }
    }

    function clearForumThreadInjection() {
        injectedThreadIds.clear();
        if (typeof forumInjectionUninject === 'function') {
            try { forumInjectionUninject(); } catch (_) {}
            forumInjectionUninject = null;
        }
        if (TH.uninjectPrompts) {
            try { TH.uninjectPrompts([FORUM_INJECT_PROMPT_ID]); } catch (_) {}
        }
    }

    function normalizePostTags(tags, title = '', content = '') {
        const raw = Array.isArray(tags) ? tags : [];
        const out = [];
        const seen = new Set();
        raw.forEach(tag => {
            const v = String(tag ?? '').replace(/^#+/, '').trim().replace(/\s+/g, ' ');
            if (!v || v.length > 12) return;
            const key = v.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key); out.push(v);
        });
        const text = `${title || ''} ${content || ''}`;
        const keywordTags = [
            ['对战', '对战'], ['比赛', '对战'], ['排位', '对战'],
            ['培育', '培育'], ['训练', '训练家'], ['新人', '新人求助'],
            ['求助', '求助'], ['求问', '求助'], ['求推荐', '求推荐'],
            ['图鉴', '图鉴'], ['进化', '进化'], ['进化石', '进化'],
            ['捕捉', '捕捉'], ['冒险', '冒险'], ['旅行', '旅行'],
            ['日常', '日常'], ['生活', '日常'], ['趣事', '趣事'],
            ['新闻', '资讯'], ['活动', '活动'], ['赛事', '赛事'],
            ['配队', '队伍搭配'], ['队伍', '队伍搭配'], ['技能', '技能研究'],
            ['属性', '属性研究'], ['道具', '道具'], ['招式', '招式'],
            ['宝可梦', '宝可梦'], ['训练家', '训练家'], ['吐槽', '吐槽'],
            ['讨论', '讨论'], ['推荐', '推荐'], ['分享', '经验分享'],
            ['攻略', '攻略'], ['实战', '实战']
        ];
        keywordTags.forEach(([needle, tag]) => {
            if (text.includes(needle) && !seen.has(tag.toLowerCase()) && out.length < 6) {
                seen.add(tag.toLowerCase()); out.push(tag);
            }
        });
        const fallbacks = ['宝可梦', '论坛讨论', '日常分享', '经验交流', '训练家'];
        for (const tag of fallbacks) {
            if (out.length >= 3) break;
            if (!seen.has(tag.toLowerCase())) { seen.add(tag.toLowerCase()); out.push(tag); }
        }
        return out.slice(0, 6);
    }

    function threadTags(t) {
        if (!t) return [];
        const first = Array.isArray(t.posts) && t.posts[0] ? t.posts[0] : {};
        const tags = normalizePostTags(t.tags, t.title, first.content);
        if (!Array.isArray(t.tags) || t.tags.join('|') !== tags.join('|')) t.tags = tags;
        return tags;
    }

    function renderTagHtml(tags, cls = '') {
        return `<div class="pkmn-thread-tags ${cls}">${tags.map(tag => `<span class="pkmn-tag">#${esc(tag)}</span>`).join('')}</div>`;
    }

    // 地区修复：旧帖子没有地区时补全宝可梦地区，避免一直显示空地区
    function ensureThreadRegion(t) {
        if (!t || currentForum === 'mature') return '未知地区';
        const first = Array.isArray(t.posts) ? t.posts[0] : null;
        if (!first) return '未知地区';
        let region = first.ipLocation || first.location || '';
        if (!region) {
            return '关都 · 真新镇';
        }
        return region;
    }

    // ============================================================
    // 论坛列表
    // ============================================================

    function renderForumList() {
        if (!threadList) {
            console.warn('[pkmn-forum] threadList missing');
            return;
        }
        try { renderTabs(); } catch (e) { console.warn('[pkmn-forum] renderTabs', e); }

        const arr =
            (threads() || []).filter(
                t =>
                    t && t.board ===
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
                    const listLocation = ensureThreadRegion(t);
                    const commentCount = Math.max(0, (t.posts?.length || 1) - 1);
                    const nestedCount = (t.posts || []).slice(1).reduce(
                        (sum, p) => sum + ensureNestedReplies(p).length,
                        0
                    );

                    d.innerHTML =
                        `
<div class="pkmn-thread-avatar">${esc(avatarName)}</div>
<div class="pkmn-thread-body">
    <div class="pkmn-thread-user">${forumUserProfileHTML(t.author || '匿名用户')}${t.isUserThread ? '<span class="pkmn-user-badge">我的帖子</span>' : '<span class="pkmn-topic-badge">讨论</span>'}</div>
    <div class="pkmn-thread-location">🌐 ${esc(listLocation)}</div>
    <div class="pkmn-thread-title">${esc(t.title || '无标题')}</div>
    <div class="pkmn-thread-snippet">${esc(snippet)}</div>
    ${renderTagHtml(threadTags(t))}
    <div class="pkmn-thread-footer">
        <span class="pkmn-thread-stat">评论 ${commentCount + nestedCount}</span>
        <span class="pkmn-thread-time">${esc(t.time || '刚刚')}</span>
    </div>
</div>

<button class="pkmn-inject" title="将本帖加入/移出正文注入（可多选）">
    ${isThreadInjected(t.id) ? '✓ 已注入' : '注入正文'}
</button>

<button class="pkmn-del" title="删除帖子">✕</button>
`;

                    d.onclick =
                        e => {
                            // 用户名/头像点击只打开资料卡，不进入帖子详情。
                            const userEl = e.target.closest && e.target.closest('[data-forum-user]');
                            if (userEl) {
                                e.preventDefault();
                                e.stopPropagation();
                                openForumUserCard(userEl.dataset.forumUser, t.posts?.[0] || null);
                                return;
                            }

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

    function openNestedComposer(rootIndex, targetIndex = -1) {
        const box = $('pkmn-posts'); if (!box) return;
        box.querySelectorAll('.pkmn-nested-composer.show').forEach(el => el.classList.remove('show'));
        const composer = box.querySelector(`.pkmn-nested-composer[data-root-index="${rootIndex}"]`); if (!composer) return;
        composer.dataset.targetIndex = String(targetIndex);
        const root = threads().find(x => x.id === currentThreadId)?.posts[rootIndex];
        const target = targetIndex >= 0 ? ensureNestedReplies(root)[targetIndex] : null;
        const input = composer.querySelector('.pkmn-nested-input');
        if (input) input.placeholder = target?.author ? `回复 @${target.author}…` : `回复 ${root?.author || '评论者'}…`;
        composer.classList.add('show'); setTimeout(() => input?.focus(), 30);
    }

    async function submitNestedReply(rootIndex, targetIndex = -1) {
        const t=threads().find(x=>x.id===currentThreadId); if(!t||!t.posts[rootIndex]) return;
        const rootPost=t.posts[rootIndex]; if(rootIndex===0){showToast('楼主正文请使用底部评论框回复');return;}
        const composer=$('pkmn-posts')?.querySelector(`.pkmn-nested-composer[data-root-index="${rootIndex}"]`); const input=composer?.querySelector('.pkmn-nested-input'); const text=input?.value.trim(); if(!text)return;
        targetIndex=Number(composer?.dataset.targetIndex ?? targetIndex); const profile=currentUserProfile(); const replies=ensureNestedReplies(rootPost); const target=targetIndex>=0?replies[targetIndex]:null;
        replies.push({author:profile.nickname,authorBio:profile.bio,isUser:true,content:text,time:'刚刚',replyToId:target?.id||null,replyToAuthor:target?.author||rootPost.author||'匿名网友'});
        input.value=''; composer.classList.remove('show'); saveChatState(); openThread(t.id);
        const n=Math.max(0,Math.min(20,parseInt(config.userReplies)||0)); if(n>0){showToast('正在生成评论下的回复…');await generateNestedReplies(t,rootPost,text,n,target);openThread(t.id);}
    }

    async function generateNestedReplies(targetThread, rootPost, targetContent, count, replyTarget = null) {
        if(!targetThread||!rootPost||count<=0)return 0;
        try{
            const ctx = await buildContext(); const parentAuthor=rootPost.author||'匿名网友';
            const history=ensureNestedReplies(rootPost).slice(-12).map((p,i)=>`${i+1}层 ${p.author}${p.replyToAuthor?` 回复 ${p.replyToAuthor}`:''}：${p.content}`).join('\n');
            const profile=currentUserProfile(); const targetLine=replyTarget?`实际回复目标：${replyTarget.author}`:`实际回复目标：${parentAuthor}`;
            const matureRule=currentForum==='mature'?'成熟向内容仍必须保持非露骨，不得生成色情行为或性器官描写。':'';
            const prompt=`你是宝可梦论坛里的匿名网友群体。
【主角论坛身份】
论坛昵称：${profile.nickname||'匿名用户'}
论坛简介：${profile.bio||'未设置'}
凡是标记为【主角本人】的内容，都代表当前聊天主角自己发送的内容。其他内容才是论坛网友。不要冒充主角。
【当前正文与世界书上下文】
${ctx}
【通讯录联动记忆】
${buildLinkedContactMemory()}
【当前帖子】《${targetThread.title}》
【当前评论】${parentAuthor}：${rootPost.content}
【已有楼中回复】
${history||'暂无'}
${targetLine}
【刚刚收到的新回复】
${targetContent}
${boardPrompt()}
${matureRule}
请生成 ${count} 条自然的楼中回复。所有回应继续归入这条评论下面；如果回应某位楼中回复者，请返回 replyToAuthor。
返回JSON数组，每项包含 author、content，可选 replyToAuthor。`;
            const raw=await callAI([{role:'system',content:prompt},{role:'user',content:'生成评论下的楼中回复。'}],0.9); let arr=parseJSON(raw); if(!Array.isArray(arr))arr=arr?[arr]:[];
            arr=arr.slice(0,count).filter(x=>x&&x.author&&x.content); const replies=ensureNestedReplies(rootPost); arr.forEach(x=>replies.push({author:x.author,content:x.content,time:'刚刚',replyToAuthor:x.replyToAuthor||null,isUser:false})); saveChatState(); if(currentThreadId===targetThread.id)openThread(targetThread.id); return arr.length;
        }catch(e){showToast('楼中回复生成失败：'+(e?.message||e));return 0;}
    }

    function renderNestedReplies(rootPost, rootIndex) {
        const nested=ensureNestedReplies(rootPost); if(!nested.length)return '';
        return `<div class="pkmn-nested-replies" data-root-index="${rootIndex}">${nested.map((r,idx)=>{const isUser=!!r.isUser;const name=String(r.author||'匿名网友');const target=r.replyToAuthor?`<span class="pkmn-nested-target">回复 @${esc(r.replyToAuthor)}</span>`:'';return `<div class="pkmn-nested-msg${isUser?' is-user':''}"><div class="pkmn-nested-main"><div class="pkmn-nested-bubble"><span class="pkmn-nested-name">${forumUserProfileHTML(name)}</span>${target}<span class="pkmn-nested-text">${esc(r.content||'')}</span></div><button class="pkmn-comment-reply-btn pkmn-nested-reply-btn" type="button" data-reply-root="${rootIndex}" data-reply-target="${idx}">回复</button></div></div>`;}).join('')}</div>`;
    }
    function renderCommentReplyComposer(rootIndex) { return `<div class="pkmn-nested-composer" data-root-index="${rootIndex}" data-target-index="-1"><input class="pkmn-nested-input" placeholder="回复这条评论..."><button class="pkmn-nested-send" type="button">发送</button></div>`; }

    let refreshingThread = false;

    async function refreshCurrentThread(t) {
        if (!t || generating || refreshingThread) return 0;
        refreshingThread = true;

        const count = Math.max(1, Math.min(12, parseInt(config.npcTalks) || 3));
        const ctx = await buildContext();
        const history = (t.posts || []).slice(-12).map((p, i) => {
            const replies = ensureNestedReplies(p);
            const nested = replies.slice(-4).map(r =>
                `    ↳ ${r.author || '匿名网友'} 回复 @${r.replyToAuthor || p.author || '匿名网友'}：${r.content || ''}`
            ).join('\n');
            return `${i + 1}楼 ${p.author || '匿名网友'}：${p.content || ''}${nested ? '\n' + nested : ''}`;
        }).join('\n');

        const userProfile = currentUserProfile();
        const matureRule = currentForum === 'mature' ? '成熟向内容必须保持非露骨，不得生成色情行为或性器官描写。' : '';
        const prompt = `
你是宝可梦论坛中的多个匿名网友。

【主角论坛身份】
论坛昵称：${userProfile.nickname || '匿名用户'}
论坛简介：${userProfile.bio || '未设置'}
标记为【主角本人】的内容属于当前聊天主角，绝对不要冒充主角发言。

${boardPrompt()}
${matureRule}

【当前正文与世界书上下文】
${ctx}

【当前帖子】
《${t.title}》

【已有讨论】
${history}

请让这个帖子继续发生自然的论坛互动，生成 ${count} 条内容。
重点是“网友之间互相聊天”，而不是简单重复发表独立评论。
可以让网友回复另一位网友、追问、反驳、补充、接着上一句话继续聊。
大多数内容应接在已有评论之后；少量情况下可以产生新的顶层评论。
不要修改或删除已有楼层。
人物昵称和说话风格要有区别，避免所有人像同一个人。

返回JSON数组：
[
  {
    "author":"匿名昵称",
    "content":"回复内容",
    "replyToFloor": 2
  }
]

replyToFloor 使用 2~${Math.max(2, t.posts.length)} 表示回复对应的已有顶层评论；如果希望发表新的顶层评论，使用 0。
`;

        const raw = await callAI([
            { role: 'system', content: prompt },
            { role: 'user', content: '继续这个帖子里的网友互动。' }
        ], 0.9);

        let arr = parseJSON(raw);
        if (!Array.isArray(arr)) arr = arr ? [arr] : [];

        let added = 0;
        arr.slice(0, count).forEach(x => {
            if (!x || !x.author || !x.content) return;
            const floor = Math.floor(Number(x.replyToFloor) || 0);
            const target = floor >= 2 && floor <= t.posts.length ? t.posts[floor - 1] : null;
            if (target) {
                ensureNestedReplies(target).push({
                    author: String(x.author),
                    content: String(x.content),
                    replyToId: target.id || null,
                    replyToAuthor: target.author || '匿名网友'
                });
            } else {
                t.posts.push({ author: String(x.author), content: String(x.content), replies: [] });
                if (!Array.isArray(t.tags) || t.tags.length < 3) t.tags = normalizePostTags(t.tags, t.title, t.posts[0]?.content || '');
            }
            added++;
        });

        saveChatState();
        renderForumList();
        if (currentThreadId === t.id) openThread(t.id);
        showToast(added ? `帖子互动完成：新增 ${added} 条` : '这次没有生成新的互动');
        refreshingThread = false;
        return added;
    }

    function openThread(id) {

        const t = threads().find(x => x.id === id);
        if (!t) return;

        currentThreadId = id;

        $('pkmn-thread-title').textContent = t.title;

        const box = $('pkmn-posts');
        box.innerHTML = '';

        // 楼主保留大块微博正文样式。
        const first = t.posts[0];
        if (first) {
            const d = topDoc.createElement('div');
            d.className = 'pkmn-post';
            const mainAvatar = String(first.author || '匿名用户').trim().slice(0, 1) || '匿';
            const mainForum = currentForum === 'mature' ? '里论坛' : '表论坛';
            const mainLocation = ensureThreadRegion(t);
            const mainComments = Math.max(0, (t.posts?.length || 1) - 1);
            const mainNested = (t.posts || []).slice(1).reduce(
                (sum, p) => sum + ensureNestedReplies(p).length,
                0
            );
            d.innerHTML = `
<div class="pkmn-post-head">
    <div class="pkmn-post-avatar">${esc(mainAvatar)}</div>
    <div class="pkmn-post-user">
        <div class="pkmn-post-author">${forumUserProfileHTML(first.author || '匿名用户')}</div>
        <div class="pkmn-post-time">${esc(t.time || '刚刚')} · ${esc(mainLocation)}</div>
    </div>
</div>
<div class="pkmn-post-floor">${esc(mainForum)} · 主题详情</div>
<div class="pkmn-post-title">${esc(t.title || '无标题')}</div>
<div class="pkmn-content">${esc(first.content || '')}</div>
${renderTagHtml(threadTags(t), 'pkmn-post-tags')}
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

        {
            const title = topDoc.createElement('div');
            title.className = 'pkmn-replies-title';
            title.innerHTML = `<span>评论 ${topLevel.length + totalNested}</span><button type="button" class="pkmn-thread-refresh-btn">刷新讨论</button>`;
            box.appendChild(title);

            const refreshBtn = title.querySelector('.pkmn-thread-refresh-btn');
            if (refreshBtn) {
                refreshBtn.onclick = async e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (generating) return;
                    refreshBtn.disabled = true;
                    refreshBtn.textContent = '生成中…';
                    try {
                        await refreshCurrentThread(t);
                    } catch (e) {
                        showToast('刷新帖子失败：' + (e?.message || e));
                    } finally {
                        refreshingThread = false;
                        const live = topDoc.querySelector('.pkmn-thread-refresh-btn');
                        if (live) { live.disabled = false; live.textContent = '刷新讨论'; }
                    }
                };
            }

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
        ${forumUserProfileHTML(name)}
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
        box.querySelectorAll('[data-forum-user]').forEach(el => {
            el.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                openForumUserCard(el.dataset.forumUser, null);
            };
        });

        box.querySelectorAll('[data-reply-root]').forEach(btn => {
            btn.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                openNestedComposer(Number(btn.dataset.replyRoot), Number(btn.dataset.replyTarget ?? -1));
            };
        });

        box.querySelectorAll('.pkmn-nested-send').forEach(btn => {
            btn.onclick = async e => {
                e.preventDefault();
                e.stopPropagation();
                await submitNestedReply(Number(btn.closest('.pkmn-nested-composer')?.dataset.rootIndex), Number(btn.closest('.pkmn-nested-composer')?.dataset.targetIndex ?? -1));
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
                currentForum === 'mature' ? '里论坛' : '表论坛';

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
ipLocation
content
tags

tags必须是 3～6 个与帖子内容高度相关的短标签，不要带 #，不要重复。
ipLocation必须由AI根据当前剧情、NPC身份、当前所在位置、居住地、旅行路线和世界书内容自行判断。
ipLocation必须符合《宝可梦》世界观，禁止随机生成。
优先使用宝可梦世界中真实存在的地区、城市、城镇、岛屿或合理地点。
优先使用“地区 · 城市/城镇”的格式，例如“关都 · 真新镇”“关都 · 金黄市”“城都 · 满金市”“丰缘 · 水静市”“神奥 · 百代市”“合众 · 飞云市”“卡洛斯 · 密阿雷市”“阿罗拉 · 好奥乐市”“伽勒尔 · 机擎市”“帕底亚 · 桌台市”。
如果角色正在旅行，应使用剧情中当前所在地点，而不是机械使用出生地。
如果剧情没有明确地点，应结合角色设定和上下文进行合理推断。
同一个NPC在没有明确移动前，应尽量保持IP属地连续；明确移动后才改变。
回复其他用户时，不要继承对方的IP属地。
禁止使用现实世界城市或国家作为IP属地。
不要只使用“关都地区”“城都地区”等过于宽泛的地区名，能具体到城市/城镇时必须具体。
ipLocation只是论坛显示的发帖地区，不是真实互联网IP。
author必须是与{{user}}无关的匿名网络昵称。

只返回JSON数组，不要解释。

格式：

[
    {
        "title":"...",
        "author":"...",
        "ipLocation":"地区 · 城市/城镇",
        "content":"..."
    }
]

${ctx}

【通讯录联动记忆】
${buildLinkedContactMemory()}
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

                            tags:
                                normalizePostTags(x.tags, x.title, x.content),

                            author:
                                x.author,

                            ipLocation:
                                x.ipLocation || x.location || '关都 · 真新镇',

                            time:
                                '刚刚',

                            posts:
                                [
                                    {
                                        author:
                                            x.author,

                                        ipLocation:
                                            x.ipLocation || x.location || '关都 · 真新镇',

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

【通讯录联动记忆】
${buildLinkedContactMemory()}

${boardPrompt()}

${matureRule}

帖子标题：
《${targetThread.title}》

最近楼层：

${history}

【当前正文与世界书上下文】
${ctx}

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

                            ipLocation:
                                x.ipLocation || x.location || '关都 · 真新镇',

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

【通讯录联动记忆】
${buildLinkedContactMemory()}
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
            tags: normalizePostTags([], title, content),
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


    function normalizeForumState(state) {
        if (!state || typeof state !== 'object') return state;
        if (!Array.isArray(state.safeThreads)) state.safeThreads = [];
        if (!Array.isArray(state.matureThreads)) state.matureThreads = [];
        if (!state.counters || typeof state.counters !== 'object') state.counters = {};
        if (!state.lastRefresh || typeof state.lastRefresh !== 'object') state.lastRefresh = {};

        const fixThread = (t) => {
            if (!t || typeof t !== 'object') return t;
            if (!Array.isArray(t.posts)) t.posts = [];
            t.posts.forEach(p => {
                if (!p || typeof p !== 'object') return;
                if (!Array.isArray(p.replies)) p.replies = [];
            });
            try {
                const firstContent = (t.posts[0] && t.posts[0].content) || '';
                if (typeof normalizePostTags === 'function') {
                    t.tags = normalizePostTags(t.tags, t.title, firstContent);
                } else if (!Array.isArray(t.tags)) {
                    t.tags = [];
                }
            } catch (_) {
                if (!Array.isArray(t.tags)) t.tags = [];
            }
            return t;
        };

        state.safeThreads = state.safeThreads.map(fixThread).filter(Boolean);
        state.matureThreads = state.matureThreads.map(fixThread).filter(Boolean);
        return state;
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

            const firstContent = t.posts[0]?.content || '';
            const normalizedTags = normalizePostTags(t.tags, t.title, firstContent);
            if (!Array.isArray(t.tags) || t.tags.join('|') !== normalizedTags.join('|')) {
                t.tags = normalizedTags;
                changed = true;
            }
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

    <div style="margin-top:10px;font-weight:700;font-size:12px">宝可萌大师</div>
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
                TH.getWorldbookNames
            ) {

                names =
                    TH.getWorldbookNames() ||
                    [];
            }

        } catch (_) {}

        if (!names.length) {

            box.innerHTML =
                `
<div class="pkmn-small">
未读取到世界书列表。请确认酒馆已加载世界书，或点「刷新世界书列表」。
</div>
`;

            updateWorldbookCount();
            return;
        }

        box.innerHTML =
            '';

        names
            .map(name => String(name ?? '').trim())
            // 世界书列表里有些版本会混入索引键/纯数字条目（0、1、2……），
            // 这些不是用户真正需要选择的世界书名称，直接隐藏。
            .filter(name => name && !/^\d+$/.test(name))
            // 防止酒馆返回重复名称导致界面重复显示。
            .filter((name, i, arr) => arr.indexOf(name) === i)
            .forEach(
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

                const input =
                    topDoc.createElement('input');
                input.type = 'checkbox';
                input.value = name;
                input.checked = checked;
                input.setAttribute('aria-label', name);

                const text =
                    topDoc.createElement('span');
                text.className = 'pkmn-check-text';
                text.textContent = name;

                // 明确使用 DOM 节点而不是 innerHTML，避免特殊世界书名称破坏结构。
                label.appendChild(input);
                label.appendChild(text);

                input.onchange =
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
    // 通讯录 / 微信式聊天
    // ============================================================
    let currentContactId = null;

    function getContactPlayerNickname() {
        contactCfg();
        return typeof config.contactPlayerNickname === 'string' ? config.contactPlayerNickname : '';
    }

    function setContactPlayerNickname(value) {
        contactCfg();
        config.contactPlayerNickname = String(value || '');
        saveContactConfig();
    }

    function getContactPlayerIdentity() {
        contactCfg();
        return typeof config.contactPlayerIdentity === 'string' ? config.contactPlayerIdentity : '';
    }

    function setContactPlayerIdentity(value) {
        contactCfg();
        config.contactPlayerIdentity = String(value || '');
        saveContactConfig();
    }

    function getContactPlayerDisplayName() {
        return getContactPlayerNickname().trim() || '我';
    }

    function contactCfg() {
        // 通讯录 API 使用独立持久化键，避免酒馆聊天档案切换/迁移时覆盖全局 API 配置。
        if (!config.contactApi) config.contactApi = clone(DEFAULT_CONFIG.contactApi);
        if (typeof config.contactApi.readForumAll !== 'boolean') config.contactApi.readForumAll = true;
        if (config.contactDefaultsVersion == null) {
            config.contactDefaultsVersion = 3;
            if (typeof config.contactApi.readForumAll !== 'boolean') config.contactApi.readForumAll = true;
        } else if (config.contactDefaultsVersion < 3) {
            config.contactDefaultsVersion = 3;
            if (typeof config.contactApi.readForumAll !== 'boolean') config.contactApi.readForumAll = true;
        }
        if (!Array.isArray(config.contacts)) config.contacts = clone(DEFAULT_CONFIG.contacts);
        // 清理旧版本预置联系人，通讯录默认保持空白。
        const legacyIds = new Set(['ash','misty','brock']);
        if (config.contacts.some(x => legacyIds.has(String(x?.id || '')))) {
            config.contacts = config.contacts.filter(x => !legacyIds.has(String(x?.id || '')));
        }
        if (!config.contactChats || typeof config.contactChats !== 'object') config.contactChats = {};
        if (!config.contactLinkMeta || typeof config.contactLinkMeta !== 'object') config.contactLinkMeta = {};
        config.contacts.forEach(c => {
            if (!c || typeof c !== 'object') return;
            if (!c.nickname) c.nickname = c.name || '匿名用户';
            if (c.note == null) c.note = '';
            if (typeof c.linkForum !== 'boolean') c.linkForum = true;
            if (!Number.isFinite(Number(c.moralScore))) c.moralScore = 50;
        });
        return config.contactApi;
    }

    function getContactChatArchiveKey(chatKey = null) {
        const key = chatKey || getChatKey();
        return (key && key !== 'fallback:unknown') ? key : null;
    }

    function emptyContactChatState() {
        return { contacts: [], contactChats: {}, contactLinkMeta: {}, contactPlayerNickname: '', contactPlayerIdentity: '', updatedAt: Date.now() };
    }

    function normalizeContactChatState(state) {
        const s = state && typeof state === 'object' ? state : emptyContactChatState();
        if (!Array.isArray(s.contacts)) s.contacts = [];
        if (!s.contactChats || typeof s.contactChats !== 'object') s.contactChats = {};
        if (!s.contactLinkMeta || typeof s.contactLinkMeta !== 'object') s.contactLinkMeta = {};
        if (typeof s.contactPlayerNickname !== 'string') s.contactPlayerNickname = '';
        if (typeof s.contactPlayerIdentity !== 'string') s.contactPlayerIdentity = '';
        s.contacts.forEach(c => {
            if (!c || typeof c !== 'object') return;
            if (!c.nickname) c.nickname = c.name || '匿名用户';
            if (c.note == null) c.note = '';
            if (typeof c.linkForum !== 'boolean') c.linkForum = true;
            if (!Number.isFinite(Number(c.moralScore))) c.moralScore = 50;
        });
        return s;
    }

    function contactChatArchiveKey(chatKey) {
        return NS + '_contacts_chat_' + simpleHash(String(chatKey || 'fallback:unknown'));
    }

    function saveContactChatArchive(chatKey = null) {
        const key = getContactChatArchiveKey(chatKey);
        if (!key) return false;
        try {
            const state = normalizeContactChatState({
                contacts: clone(config.contacts || []),
                contactChats: clone(config.contactChats || {}),
                contactLinkMeta: clone(config.contactLinkMeta || {}),
                contactPlayerNickname: String(config.contactPlayerNickname || ''),
                contactPlayerIdentity: String(config.contactPlayerIdentity || ''),
                updatedAt: Date.now()
            });
            localStorage.setItem(contactChatArchiveKey(key), JSON.stringify(state));
            return true;
        } catch (e) {
            console.warn('[pkmn-forum] saveContactChatArchive failed', e);
            return false;
        }
    }

    function loadContactChatArchive(chatKey = null) {
        const key = getContactChatArchiveKey(chatKey);
        if (!key) return null;
        try {
            const raw = localStorage.getItem(contactChatArchiveKey(key));
            return raw ? normalizeContactChatState(JSON.parse(raw)) : null;
        } catch (e) {
            console.warn('[pkmn-forum] loadContactChatArchive failed', e);
            return null;
        }
    }

    function switchContactChat(forcedKey = null, options = {}) {
        const key = getContactChatArchiveKey(forcedKey);
        if (!key) return false;
        const current = getContactChatArchiveKey(config.__contactActiveChatKey);
        if (current === key) {
            currentContactId = null;
            return true;
        }

        // 首次建立当前聊天档：迁移旧版全局通讯录到当前聊天一次。
        if (!config.__contactArchiveMigrated) {
            const existing = loadContactChatArchive(key);
            if (!existing && ((config.contacts && config.contacts.length) || Object.keys(config.contactChats || {}).length)) {
                saveContactChatArchive(key);
            }
            config.__contactArchiveMigrated = true;
        }

        if (current) saveContactChatArchive(current);

        const next = loadContactChatArchive(key);
        const state = next || emptyContactChatState();
        config.contacts = state.contacts;
        config.contactChats = state.contactChats;
        config.contactLinkMeta = state.contactLinkMeta;
        config.contactPlayerNickname = String(state.contactPlayerNickname || '');
        config.contactPlayerIdentity = String(state.contactPlayerIdentity || '');
        config.__contactActiveChatKey = key;
        currentContactId = null;
        saveGlobalConfig();

        // 当前正显示通讯录时立即刷新；新聊天没有档案时自然显示空通讯录。
        try {
            if (document.getElementById('pkmn-contacts')?.classList.contains('active')) renderContacts();
            if (document.getElementById('pkmn-chat')?.classList.contains('active')) openView('contacts');
        } catch (_) {}
        if (!options.silent) showToast(next ? '已恢复本聊天通讯录' : '新聊天：通讯录已清空');
        return true;
    }

    function saveContactConfig() {
        const c = config.contactApi || (config.contactApi = clone(DEFAULT_CONFIG.contactApi));
        if (typeof c.readForumAll !== 'boolean') c.readForumAll = true;
        // API 配置与当前酒馆聊天的联系人档案分开保存；切换新/旧聊天不会丢失 API。
        try {
            localStorage.setItem(NS + '_contact_api', JSON.stringify({
                endpoint: c.endpoint || '',
                key: c.key || '',
                model: c.model || '',
                models: Array.isArray(c.models) ? c.models : [],
                temperature: Number.isFinite(Number(c.temperature)) ? Number(c.temperature) : 0.85,
                maxTokens: Number.isFinite(Number(c.maxTokens)) ? Number(c.maxTokens) : 900,
                systemPrompt: c.systemPrompt || DEFAULT_CONFIG.contactApi.systemPrompt,
                readForumAll: c.readForumAll !== false
            }));
        } catch (e) {
            console.warn('[pkmn-forum] save contact API config failed', e);
        }
        saveContactChatArchive();
        saveGlobalConfig();
    }

    function contactApiBase() {
        return normalizeEndpointInput(contactCfg().endpoint);
    }

    async function callContactAI(messages) {
        const c = contactCfg();
        const base = contactApiBase();
        if (!base) throw new Error('请先在通讯录设置中配置 API');
        if (!c.model) throw new Error('请先填写通讯录模型');
        const res = await fetch(base + '/chat/completions', {
            method:'POST',
            headers:{
                'Content-Type':'application/json',
                ...(c.key ? {Authorization:'Bearer '+c.key} : {})
            },
            body:JSON.stringify({
                model:c.model,
                messages,
                temperature:Number(c.temperature) || 0.85,
                max_tokens:Number(c.maxTokens) || 900
            })
        });
        if (!res.ok) throw new Error('HTTP '+res.status);
        const data = await res.json();
        const message = data?.choices?.[0]?.message || {};
        const content = message?.content;
        // 只使用模型最终 content，不把 reasoning_content 混进业务回复。
        // 否则推理过程里出现的“50”等数字可能被道德评分解析器误当成最终评分。
        const flatten = value => {
            if (typeof value === 'string') return value;
            if (Array.isArray(value)) return value.map(x => typeof x === 'string' ? x : (x?.text || x?.content || '')).join('\n');
            if (value && typeof value === 'object') return String(value.text || value.content || '');
            return '';
        };
        return flatten(content);
    }

    function extractContactMoralResult(raw) {
        const text = String(raw || '').trim();
        if (!text) return null;

        // 1) 首先尝试严格/代码块/嵌套 JSON。
        let obj = null;
        try { obj = parseJSON(text); } catch (_) {}
        if (Array.isArray(obj)) obj = obj[0];
        const fromObj = Number(obj?.score);
        if (Number.isFinite(fromObj)) {
            return {
                score: fromObj,
                label: String(obj?.label || ''),
                stage: String(obj?.stage || ''),
                loyalty: obj?.loyalty,
                affinity: obj?.affinity,
                reason: String(obj?.reason || '')
            };
        }

        // 2) 兼容模型返回“道德评分：85”“score: 85”“评分 85/100”等普通文本。
        const patterns = [
            /(?:道德(?:倾向)?评分|道德分数|道德值|评分|score|moral(?:\s*score)?)[^0-9]{0,24}(\d{1,3})(?:\s*(?:\/\s*100|分|%))?/i,
            /(?:^|\n)\s*(\d{1,3})\s*(?:\/\s*100|分)\s*(?:$|\n)/i
        ];
        let score = NaN;
        for (const re of patterns) {
            const m = text.match(re);
            if (m) { score = Number(m[1]); break; }
        }
        if (!Number.isFinite(score) || score < 0 || score > 100) return null;

        const labelMatch = text.match(/(?:label|等级|道德等级|倾向)[^\S\r\n]*[:：]?[^\S\r\n]*["“”']?([^\n,，}\"]{1,12})/i);
        const reasonMatch = text.match(/(?:reason|理由|依据|原因)[^\S\r\n]*[:：]?\s*([^\n]{1,160})/i);
        return {
            score,
            label: labelMatch ? labelMatch[1].trim() : '',
            stage: '',
            loyalty: undefined,
            affinity: undefined,
            reason: reasonMatch ? reasonMatch[1].trim() : text.slice(0, 160)
        };
    }

    async function contactTestConnection() {
        const c = contactCfg();
        const base = contactApiBase();
        if (!base) throw new Error('请先填写通讯录 API Endpoint');
        const res = await fetch(base + '/models', { headers: { ...(c.key ? {Authorization:'Bearer '+c.key} : {}) } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    }

    async function loadContactModels() {
        const c = contactCfg();
        const data = await contactTestConnection();
        const raw = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const models = raw.map(m => typeof m === 'string' ? m : (m?.id || m?.name || '')).filter(Boolean);
        if (!models.length) throw new Error('接口正常，但没有返回模型');
        c.models = models;
        if (!c.model || !models.includes(c.model)) c.model = models[0];
        saveContactConfig();
        renderContactSettings();
        return models;
    }

    function contactById(id) {
        return config.contacts.find(x => x.id === id);
    }

    function contactByNickname(nickname) {
        const n = String(nickname || '').trim();
        if (!n) return null;
        return config.contacts.find(c => String(c.nickname || c.name || '').trim() === n) || null;
    }

    function contactDisplayName(c) {
        if (!c) return '匿名用户';
        return String(c.note || '').trim() || String(c.nickname || c.name || '匿名用户');
    }

    function getContactChatMemory(c, maxChars=7000) {
        if (!c || !c.id) return '';
        const chat = Array.isArray(config.contactChats[c.id]) ? config.contactChats[c.id] : [];
        if (!chat.length) return '';
        const lines = chat.slice(-24).map(m => `${m.role === 'user' ? '玩家' : (c.nickname || c.name || '联系人')}：${String(m.content || '')}`);
        return lines.join('\n').slice(-maxChars);
    }

    function moralBehaviorProfile(score) {
        const n = Math.max(0, Math.min(100, Math.round(Number(score) || 50)));
        if (n <= 15) return {stage:'危险型', range:'0～15', summary:'底线极低，容易把他人当作手段。', actions:'可能为利益出卖他人、利用秘密威胁、故意挑拨、报复或制造冲突；不是无条件作恶，但当利益、愤怒或报复动机足够强时更容易越过底线。', privacy:'默认不可靠，可能把私聊当筹码；只有风险过高或关系/利益不允许时才收手。'};
        if (n <= 30) return {stage:'恶意/利己型', range:'16～30', summary:'明显利己，边界感较差。', actions:'容易八卦、添油加醋、嘲讽、利用信息换取利益；受到怂恿、奖励或情绪刺激时更可能泄露秘密。', privacy:'通常不会主动保护秘密，除非泄密对自己不利或关系较好。'};
        if (n <= 45) return {stage:'灰色自私型', range:'31～45', summary:'不一定恶毒，但优先考虑自己。', actions:'可能看热闹、冷漠旁观、为了方便自己说出部分信息；常见态度是“我不害你，但也没义务替你保密”。', privacy:'不会主动传播所有私聊，但被追问、利益交换或关系恶化时可能松口。'};
        if (n <= 60) return {stage:'普通人', range:'46～60', summary:'有基本良知，也有现实利益。', actions:'通常不主动泄密，偶尔吐槽或说漏无关紧要的信息；遇到明显冲突会先保护自己，不会为了玩家无条件牺牲。', privacy:'一般保留私聊，但不是绝对守密；关系、情绪、风险和场景会影响行为。'};
        if (n <= 75) return {stage:'可靠型', range:'61～75', summary:'有较稳定的良知和边界感。', actions:'倾向帮助别人、拒绝恶意造谣、尊重隐私；与玩家发生小矛盾也通常不会拿私聊报复。', privacy:'默认保护私聊，被询问时倾向拒绝或只说无敏感内容。'};
        if (n <= 90) return {stage:'高道德/守密型', range:'76～90', summary:'原则感强，重视隐私、公平与他人安全。', actions:'会主动阻止恶意传播、纠正明显造谣；不会因金钱、八卦或一时生气轻易泄密。', privacy:'强保护私聊；即使关系恶化，也不会把隐私当报复工具。遇到严重伤害他人的情况会优先考虑安全与原则。'};
        return {stage:'极高道德型', range:'91～100', summary:'极少见，具有稳定且一致的高道德原则。', actions:'长期守信、尊重隐私、帮助弱者、不利用秘密获利；面对利益诱惑或个人恩怨也保持底线。', privacy:'几乎不会为了八卦、利益、情绪或讨好第三方泄露私聊；但不会无条件包庇正在严重伤害他人的行为。'};
    }

    function getMoralBehaviorText(score) {
        const p = moralBehaviorProfile(score);
        return `道德阶段：${p.stage}（${p.range}）\n阶段倾向：${p.summary}\n可能行为：${p.actions}\n私聊处理：${p.privacy}`;
    }

    function buildLinkedContactMemory() {
        contactCfg();
        const linked = config.contacts.filter(c => c && c.linkForum);
        if (!linked.length) return '【通讯录联动】当前没有开启与论坛联动的联系人。';
        const blocks = linked.map(c => {
            const nickname = c.nickname || c.name || '匿名用户';
            const memory = getContactChatMemory(c);
            const rawMoral = Number(c.moralScore);
            const moral = Number.isFinite(rawMoral) ? Math.max(0, Math.min(100, rawMoral)) : 50;
            return `【联系人：${nickname}】\n身份说明：论坛昵称与微信原昵称一致；玩家在私聊中是“玩家本人”，不是普通匿名网友。\n道德值：${moral}/100\n聊天记忆：\n${memory || '（暂无聊天记录）'}`;
        });
        return `【已开启“此聊天与论坛联动”的通讯录联系人】
${blocks.join('\n\n')}

【私聊记忆与道德检定——必须执行】
1. 这些聊天记录属于玩家与联系人之间的私聊记忆，不是论坛公开资料；只能用于人物连续性、态度、判断和剧情参考。
2. 联系人必须认出“玩家本人”，不要把当前玩家误认成普通匿名论坛网友。
3. 每次准备把私聊内容带入论坛发言前，先进行一次“是否泄露”的道德与动机检定：综合道德阶段、NPC性格、与玩家关系/好感、忠诚度、利益、情绪、风险、第三方在场情况和当前场景。
4. 道德值0～15：危险型；可能把秘密当筹码，在利益、报复、威胁等强动机下主动利用或泄露，但仍要符合剧情。
5. 道德值16～30：恶意/利己型；容易八卦、添油加醋、交换情报或因利益/怂恿泄密。
6. 道德值31～45：灰色自私型；不会无缘无故伤害玩家，但可能认为“没有义务替你保密”，在关系恶化、利益交换或被追问时松口。
7. 道德值46～60：普通人；通常保留私聊，但会优先保护自己，不是绝对守密；可能出现轻微、无敏感内容的口头泄露。
8. 道德值61～75：可靠型；倾向保护隐私、拒绝恶意传播，即使与玩家发生普通矛盾也不拿私聊报复。
9. 道德值76～90：高道德/守密型；强保护隐私，不因八卦、金钱或一时愤怒轻易泄密，并可能主动阻止恶意传播。
10. 道德值91～100：极高道德型；极少见，具有稳定原则，不利用秘密获利，也不因个人恩怨泄密；但严重危害他人时不会机械包庇。
11. 道德值只是底线倾向，不是行为开关；低道德不等于每次都泄密，高道德也不等于无条件替玩家隐瞒。
12. 即使允许泄露，也只能说NPC当下愿意说出的必要部分；禁止机械复制、逐字转述或倾倒整段私聊记录。
13. 如果检定结果为“保护私聊”，论坛发言不得出现可追溯到私聊原文的具体信息；可以保留NPC因此产生的情绪、态度或关系变化。
14. 开启联动绝不等于授权公开私聊。论坛AI不得因为看到了聊天记录就自动泄密。`;
    }

    function forumUserProfileHTML(author, extraClass='') {
        return `<span class="pkmn-clickable-user ${extraClass}" data-forum-user="${esc(author)}" title="查看用户资料 / 加好友">${esc(author)}</span>`;
    }

    // 论坛用户名统一使用事件委托，兼容帖子列表、帖子详情以及动态重绘后的内容。
    if (!panel.__pkmnForumUserDelegate) {
        panel.__pkmnForumUserDelegate = true;
        panel.addEventListener('click', e => {
            const userEl = e.target && e.target.closest ? e.target.closest('[data-forum-user]') : null;
            if (!userEl || !panel.contains(userEl)) return;
            if (userEl.closest('.pkmn-user-card-modal')) return;
            e.preventDefault();
            e.stopPropagation();
            const author = userEl.dataset.forumUser || userEl.textContent || '匿名用户';
            openForumUserCard(author, null);
        }, true);
    }

    function forumMoralEvidenceForUser(name) {
        const target = normalizeSearchText(String(name || ''));
        if (!target) return '论坛中没有可检索的用户名。';
        const allThreads = [];
        for (const boardThreads of [chatState?.safeThreads, chatState?.matureThreads]) {
            if (Array.isArray(boardThreads)) allThreads.push(...boardThreads);
        }
        const blocks = [];
        for (const t of allThreads) {
            if (!t || !Array.isArray(t.posts)) continue;
            const matched = [];
            for (const post of t.posts) {
                if (!post) continue;
                const author = String(post.author || '');
                const authorKey = normalizeSearchText(author);
                if (authorKey && (authorKey === target || authorKey.includes(target) || target.includes(authorKey))) {
                    matched.push({type:'主帖/楼层', author, content:String(post.content || '')});
                }
                const replies = Array.isArray(post.replies) ? post.replies : [];
                for (const r of replies) {
                    if (!r) continue;
                    const ra = String(r.author || '');
                    const replyAuthorKey = normalizeSearchText(ra);
                    if (replyAuthorKey && (replyAuthorKey === target || replyAuthorKey.includes(target) || target.includes(replyAuthorKey))) {
                        matched.push({type:'回复', author:ra, content:String(r.content || ''), replyToAuthor:String(r.replyToAuthor || '')});
                    }
                }
            }
            if (matched.length) {
                blocks.push(`【帖子：${String(t.title || '无标题')}】\n${matched.map(x => `${x.type}｜${x.author}${x.replyToAuthor ? ` → 回复 ${x.replyToAuthor}` : ''}\n${x.content}`).join('\n\n')}`);
            }
        }
        return blocks.length ? blocks.join('\n\n').slice(0, 30000) : '当前聊天的论坛存档中没有找到该用户的发帖、评论或回复。';
    }

    function showContactAddProgress(text='正在添加好友…') {
        const old = topDoc.getElementById('pkmn-contact-add-progress');
        if (old) old.remove();
        const modal = topDoc.createElement('div');
        modal.id = 'pkmn-contact-add-progress';
        modal.className = 'pkmn-contact-add-progress';
        modal.innerHTML = `
<div class="pkmn-contact-add-progress-backdrop"></div>
<div class="pkmn-contact-add-progress-box" role="status" aria-live="polite">
  <div class="pkmn-contact-add-progress-spinner"></div>
  <div class="pkmn-contact-add-progress-title">正在添加好友</div>
  <div class="pkmn-contact-add-progress-text">${esc(text)}</div>
  <div class="pkmn-contact-add-progress-hint">请稍候…</div>
</div>`;
        const host = topDoc.getElementById('pkmn-phone-panel') || topDoc.body;
        host.appendChild(modal);
        return modal;
    }

    function updateContactAddProgress(text) {
        const modal = topDoc.getElementById('pkmn-contact-add-progress');
        if (!modal) return;
        const el = modal.querySelector('.pkmn-contact-add-progress-text');
        if (el) el.textContent = String(text || '正在处理…');
    }

    function hideContactAddProgress() {
        const modal = topDoc.getElementById('pkmn-contact-add-progress');
        if (modal) modal.remove();
    }

    async function assessContactMoral(info) {
        const c = contactCfg();
        const progress = typeof info?.onProgress === 'function' ? info.onProgress : () => {};
        progress('正在检查当前论坛记录…');
        if (!contactApiBase()) throw new Error('请先在通讯录设置中配置 API');
        if (!c.model) throw new Error('请先在通讯录设置中选择模型');
        const name = String(info?.name || '匿名用户').trim();
        const bio = String(info?.bio || '').trim();
        const location = String(info?.location || '').trim();
        const sourceText = String(info?.sourcePost?.content || info?.sourcePost?.text || '');
        const forumEvidence = forumMoralEvidenceForUser(name);
        progress('正在读取世界书与角色设定…');
        let worldbook = '';
        try {
            // 道德检定专门读取当前已选择世界书中与该人物/论坛记录相关的角色设定。
            worldbook = await getSelectedWorldbookText(`${name} ${bio} ${sourceText} ${forumEvidence.slice(0,12000)}`);
        } catch (_) { worldbook = ''; }
        const currentChat = getMainChatText(config.readDepth);
        progress('正在整理论坛与正文证据…');
        const player = currentUserProfile();
        const prompt = `根据提供的角色设定与当前论坛实际行为，判断这个联系人的稳定道德倾向。\n\n【人物】\n昵称：${name}\n简介：${bio || '无'}\nIP属地：${location || '未知'}\n\n【正文世界书 / 角色设定】\n${worldbook ? worldbook.slice(0,22000) : '未检索到相关世界书条目。不得凭空补充原作经历。'}\n\n【当前正文】\n${currentChat ? currentChat.slice(0,12000) : '无'}\n\n【当前聊天论坛中检索到的该用户实际行为】\n${forumEvidence}\n\n【评分】\n0～15 危险型；16～30 恶意/利己型；31～45 灰色自私型；46～60 普通人；61～75 可靠型；76～90 高道德/守密型；91～100 极高道德型。\n\n只根据上面的证据判断。论坛实际行为优先；世界书用于人物背景和明确设定。没有论坛记录时，不得假装有论坛行为；没有世界书依据时，也不得编造原作经历。不要因为证据不足机械给50，也不要为了避免极端而统一压到中间区间。一次事件不能单独决定全部人格。\n\n只返回JSON，不要Markdown或额外文字：\n{"score":数值,"label":"较低/一般/较高/很高","stage":"七阶段之一","loyalty":数值,"affinity":数值,"reason":"不超过100字的关键依据"}`;
        progress('正在进行 AI 道德检定…');
        const raw = await callContactAI([{role:'system',content:'只做人物道德检定，严格依据给定资料，不编造。'}, {role:'user',content:prompt}]);
        progress('正在解析检定结果…');
        const result = extractContactMoralResult(raw);
        if (!result) {
            console.warn('[pkmn-forum] contact moral AI returned unparseable result:', raw);
            throw new Error('AI 未返回有效的道德评分');
        }
        const n = Number(result.score);
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('AI 返回的道德评分无效');
        const score = Math.max(0, Math.min(100, Math.round(n)));
        const label = String(result.label || (score < 46 ? '较低' : score < 76 ? '一般' : score < 91 ? '较高' : '很高'));
        const loyalty = Math.max(0, Math.min(100, Math.round(Number.isFinite(Number(result.loyalty)) ? Number(result.loyalty) : 50)));
        const affinity = Math.max(0, Math.min(100, Math.round(Number.isFinite(Number(result.affinity)) ? Number(result.affinity) : 50)));
        const behavior = moralBehaviorProfile(score);
        return {score, label, stage:String(result.stage || behavior.stage), loyalty, affinity, reason:String(result.reason||'').trim().slice(0,500)};
    }

    function openForumUserCard(author, sourcePost=null) {
        const name = String(author || '匿名用户').trim();
        if (!name) return;
        contactCfg();
        const existing = contactByNickname(name);
        const avatar = name.slice(0,1) || '匿';
        const bio = String(sourcePost?.authorBio || sourcePost?.bio || '').trim();
        const location = String(sourcePost?.ipLocation || sourcePost?.location || '').trim();
        const modal = topDoc.createElement('div');
        modal.className = 'pkmn-user-card-modal';
        modal.innerHTML = `
<div class="pkmn-user-card-backdrop"></div>
<div class="pkmn-user-card">
  <button class="pkmn-user-card-close" type="button">×</button>
  <div class="pkmn-user-card-avatar">${esc(avatar)}</div>
  <div class="pkmn-user-card-name">${esc(name)}</div>
  <div class="pkmn-user-card-sub">论坛用户</div>
  ${location ? `<div class="pkmn-user-card-line">IP属地：${esc(location)}</div>` : ''}
  ${bio ? `<div class="pkmn-user-card-line">${esc(bio)}</div>` : ''}
  <div class="pkmn-user-card-actions">
    ${existing ? `<button class="pkmn-btn pkmn-primary" data-user-card-chat>发消息</button>` : `<button class="pkmn-btn pkmn-primary" data-user-card-add>加为好友</button>`}
    <button class="pkmn-btn pkmn-secondary" data-user-card-close>取消</button>
  </div>
</div>`;
        // 资料卡必须挂在手机面板内，否则 #pkmn-phone-panel 下的样式不会命中。
        // 使用 appendChild(panel) 后，点击论坛用户时资料卡会稳定显示在手机界面上。
        const host = topDoc.getElementById('pkmn-phone-panel') || topDoc.body;
        host.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelectorAll('[data-user-card-close], .pkmn-user-card-backdrop, .pkmn-user-card-close').forEach(el => el.onclick = close);
        const addBtn = modal.querySelector('[data-user-card-add]');
        if (addBtn) addBtn.onclick = async () => {
            if (addBtn.disabled) return;
            addBtn.disabled = true; addBtn.textContent = '正在添加…';
            const progressModal = showContactAddProgress('正在检查当前论坛记录…');
            try {
                const moral = await assessContactMoral({name, bio, location, sourcePost, onProgress: updateContactAddProgress});
                const id = 'c_' + Date.now() + '_' + Math.floor(Math.random()*10000);
                config.contacts.push({id, nickname:name, name, avatar, note:'', bio, location, linkForum:true, moralScore:moral.score, moralLabel:moral.label, moralStage:moral.stage, moralLoyalty:moral.loyalty, moralAffinity:moral.affinity, moralReason:moral.reason});
                config.contactChats[id] = [];
                saveContactConfig(); close();
                hideContactAddProgress();
                showToast(`已添加好友：${name}`);
            } catch(e) {
                hideContactAddProgress();
                addBtn.disabled = false; addBtn.textContent = '加为好友';
                showToast('添加好友失败：'+(e?.message||e));
            }
        };
        const chatBtn = modal.querySelector('[data-user-card-chat]');
        if (chatBtn) chatBtn.onclick = () => { close(); openContact(existing.id); };
    }

    function renderContacts(filter='') {
        contactCfg();
        const list = $('pkmn-contact-list');
        if (!list) return;
        const q = String(filter || '').trim().toLowerCase();
        const items = config.contacts.filter(c => !q || [c.nickname,c.name,c.note,c.location].join(' ').toLowerCase().includes(q));
        list.innerHTML = items.map(c => {
            const chat = config.contactChats[c.id] || [];
            const last = chat.length ? chat[chat.length-1].content : (c.note || '点击开始聊天');
            const time = chat.length ? chat[chat.length-1].time : '';
            return `<button class="wechat-contact" data-contact="${esc(c.id)}">
                <span class="wechat-avatar">${esc(c.avatar || '👤')}</span>
                <span class="wechat-contact-main"><b>${esc(contactDisplayName(c))}</b><small>${esc(last).slice(0,48)}</small></span>
                <time>${esc(time)}</time>
            </button>`;
        }).join('') || '<div class="wechat-empty">没有找到联系人</div>';
        list.querySelectorAll('[data-contact]').forEach(el => el.onclick = () => openContact(el.dataset.contact));
    }

    function renderChat() {
        const c = contactById(currentContactId);
        if (!c) return;
        const contactName = contactDisplayName(c);
        const playerName = getContactPlayerDisplayName();
        $('pkmn-chat-title').textContent = contactName;
        const box = $('pkmn-chat-messages');
        const msgs = config.contactChats[currentContactId] || [];
        box.innerHTML = msgs.map(m => {
            const mine = m.role === 'user';
            const displayName = mine ? playerName : contactName;
            const avatarText = mine ? playerName.slice(0, 1) : String(c.avatar || contactName || '👤').slice(0, 1);
            return `<div class="wechat-msg-row ${mine?'mine':'theirs'}">
                ${mine ? '' : `<span class="wechat-avatar mini">${esc(avatarText)}</span>`}
                <div class="wechat-msg-main">
                    <div class="wechat-msg-name">${esc(displayName)}</div>
                    <div class="wechat-bubble">${esc(m.content).replace(/\n/g,'<br>')}</div>
                    <small class="wechat-time">${esc(m.time||'')}</small>
                </div>
                ${mine ? `<span class="wechat-avatar mini me">${esc(avatarText)}</span>` : ''}
            </div>`;
        }).join('') || `<div class="wechat-daytip">与 ${esc(contactName)} 的聊天</div>`;
        box.scrollTop = box.scrollHeight;
    }

    function openContact(id) {
        currentContactId = id;
        renderChat();
        openView('chat');
        setTimeout(() => $('pkmn-chat-input')?.focus(), 120);
    }

    async function sendContactMessage() {
        const input = $('pkmn-chat-input');
        const text = String(input?.value || '').trim();
        const c = contactById(currentContactId);
        if (!text || !c) return;
        contactCfg();
        if (!config.contactChats[currentContactId]) config.contactChats[currentContactId] = [];
        const chat = config.contactChats[currentContactId];
        chat.push({role:'user', content:text, time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})});
        input.value = '';
        renderChat();
        const typing = document.createElement('div');
        typing.className='wechat-typing';
        typing.textContent=contactDisplayName(c)+' 正在输入…';
        $('pkmn-chat-messages').appendChild(typing);
        try {
            const context = await buildContext();
            let forumContext = '';
            if (contactCfg().readForumAll) {
                const allThreads = [...(chatState.safeThreads || []), ...(chatState.matureThreads || [])];
                forumContext = '\n【论坛全部内容】\n' + JSON.stringify(allThreads).slice(0, 30000);
            }
            const contactPlayerNickname = getContactPlayerDisplayName();
            const contactPlayerIdentity = getContactPlayerIdentity();
            const system = `${contactCfg().systemPrompt}\n\n【联系人资料】\n微信原昵称：${c.nickname || c.name}\n通讯录备注：${c.note||''}\n简介：${c.bio||''}\n当前位置：${c.location||'未知'}\n道德值：${Math.max(0,Math.min(100,Number.isFinite(Number(c.moralScore)) ? Number(c.moralScore) : 50))}/100\n${getMoralBehaviorText(Number(c.moralScore))}\n对玩家忠诚倾向：${Math.max(0,Math.min(100,Number.isFinite(Number(c.moralLoyalty)) ? Number(c.moralLoyalty) : 50))}/100\n对玩家好感倾向：${Math.max(0,Math.min(100,Number.isFinite(Number(c.moralAffinity)) ? Number(c.moralAffinity) : 50))}/100\n\n【微信玩家身份】\n玩家昵称：${contactPlayerNickname}\n玩家身份：${contactPlayerIdentity || '未设置'}\n当前聊天对象就是上述昵称与身份的玩家本人，不要把玩家当成普通论坛网友。\n${context ? '\n【当前世界/剧情资料】\n'+context.slice(0,18000) : ''}${forumContext}`;
            const recent = chat.slice(-20).map(m => ({role:m.role, content:m.content}));
            const reply = await callContactAI([{role:'system',content:system}, ...recent]);
            typing.remove();
            chat.push({role:'assistant', content:reply || '……', time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})});
            saveContactConfig();
            renderChat();
            renderContacts($('pkmn-contact-search')?.value || '');
        } catch (e) {
            typing.remove();
            chat.push({role:'assistant', content:'消息发送失败：'+(e.message||e), time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})});
            renderChat();
        }
    }

    function renderContactPersonSettings() {
        const c = contactById(currentContactId);
        if (!c) return;
        contactCfg();
        const body = $('pkmn-contact-person-settings-body');
        if (!body) return;
        const score = Math.max(0, Math.min(100, Number.isFinite(Number(c.moralScore)) ? Number(c.moralScore) : 50));
        const label = c.moralLabel || (score < 40 ? '较低' : score < 70 ? '一般' : score < 85 ? '较高' : '很高');
        const avatar = String(c.avatar || (c.nickname || c.name || '匿').slice(0,1));
        body.innerHTML = `
            <div class="contact-settings-profile">
                <div class="contact-settings-avatar">${esc(avatar)}</div>
                <div class="contact-settings-profile-main">
                    <div class="contact-settings-name">${esc(c.nickname || c.name || '匿名用户')}</div>
                    <div class="contact-settings-original">微信原昵称：${esc(c.nickname || c.name || '匿名用户')}</div>
                </div>
            </div>

            <section class="contact-settings-card">
                <div class="contact-settings-section-title"><span class="contact-settings-icon">✎</span> 备注</div>
                <label class="contact-settings-field-label">备注名
                    <input class="pkmn-input contact-settings-input" id="contact-person-note" value="${esc(c.note||'')}" placeholder="设置备注名">
                </label>
                <div class="contact-settings-hint">通讯录列表显示备注名；不设置时显示原微信昵称。</div>
            </section>

            <section class="contact-settings-card contact-settings-link-card">
                <div class="contact-settings-section-title"><span class="contact-settings-icon">🔗</span> 论坛联动</div>
                <label class="contact-settings-toggle-row" for="contact-person-link-forum">
                    <span>
                        <b>此聊天与论坛联动</b>
                        <small>开启后，论坛 AI 可读取此联系人的通讯录聊天记忆；该联系人在论坛发帖、评论时也可参考与你的私聊记忆。</small>
                    </span>
                    <input type="checkbox" id="contact-person-link-forum" ${c.linkForum !== false ? 'checked' : ''}>
                    <i aria-hidden="true"></i>
                </label>
                <div class="contact-settings-persist">ⓘ 此设置为当前联系人的独立设置，修改后立即保存，下次打开仍保持当前状态。</div>
            </section>

            <button type="button" class="contact-moral-unlock-btn" id="contact-moral-unlock-btn" style="background:#fff;color:#222;border:1px solid #d0d0d0;border-radius:8px;padding:9px 12px;width:100%;margin-top:10px;">道德检定</button>
            <div id="contact-moral-unlock-box" style="display:none;margin-top:8px;">
                <input id="contact-moral-unlock-input" type="text" autocomplete="off" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #ccc;border-radius:8px;" />
            </div>
            <section class="contact-settings-card" id="contact-moral-settings-panel" style="display:none;">
                <div class="contact-settings-section-title"><span class="contact-settings-icon">◈</span> 道德检定</div>
                <div class="contact-settings-score">AI 判定：<b>${esc(label)}</b><span>·</span><strong>${score} / 100</strong></div>
                <div class="contact-settings-hint">加好友时由通讯录 AI 根据 NPC 人设、正文、世界书和论坛表现判断并保存。不能手动修改。</div>
                <div class="contact-settings-reason">行为阶段：${esc(c.moralStage || moralBehaviorProfile(score).stage)}</div>
                <div class="contact-settings-reason">行为倾向：${esc(getMoralBehaviorText(score))}</div>
                ${c.moralReason ? `<div class="contact-settings-reason">判断依据：${esc(c.moralReason)}</div>` : ''}
            </section>

            <button class="contact-settings-save" id="contact-person-save"><span>✓</span> 保存联系人设置</button>
            <button class="contact-settings-delete" id="contact-person-delete" type="button"><span>🗑</span> 删除联系人</button>
        `;

        const toggle = $('contact-person-link-forum');
        toggle.onchange = (e) => {
            c.linkForum = !!e.target.checked;
            saveContactConfig();
            showToast(c.linkForum ? '✓ 已开启此聊天与论坛联动' : '✓ 已关闭此聊天与论坛联动');
        };
        $('contact-moral-unlock-btn').onclick = () => {
            const box = $('contact-moral-unlock-box');
            const input = $('contact-moral-unlock-input');
            box.style.display = 'block';
            input.value = '';
            input.focus();
        };
        $('contact-moral-unlock-input').oninput = (e) => {
            if (String(e.target.value) === '114516') {
                $('contact-moral-settings-panel').style.display = 'block';
                $('contact-moral-unlock-box').style.display = 'none';
            }
        };
        $('contact-person-save').onclick = () => {
            c.note = $('contact-person-note').value.trim();
            c.linkForum = !!toggle.checked;
            saveContactConfig();
            showToast('✓ 联系人设置已保存');
            renderContacts();
            $('pkmn-chat-title').textContent = contactDisplayName(c);
            renderContactPersonSettings();
        };
        $('contact-person-delete').onclick = () => {
            const name = contactDisplayName(c);
            if (!window.confirm(`删除联系人“${name}”？\n\n将删除该联系人在当前酒馆聊天中的资料、备注、联动设置及通讯录聊天记录。此操作无法恢复。`)) return;
            const idx = config.contacts.findIndex(x => String(x.id) === String(currentContactId));
            if (idx < 0) return;
            config.contacts.splice(idx, 1);
            if (config.contactChats && Object.prototype.hasOwnProperty.call(config.contactChats, currentContactId)) {
                delete config.contactChats[currentContactId];
            }
            if (config.contactLinkMeta && Object.prototype.hasOwnProperty.call(config.contactLinkMeta, currentContactId)) {
                delete config.contactLinkMeta[currentContactId];
            }
            currentContactId = null;
            saveContactConfig();
            renderContacts();
            openView('contacts');
            showToast(`✓ 已删除联系人：${name}`);
        };
    }

    function openCurrentContactSettings() {
        if (!contactById(currentContactId)) return;
        renderContactPersonSettings();
        openView('contactPersonSettings');
    }

    function renderContactSettings() {
        const c = contactCfg();
        const models = Array.isArray(c.models) ? c.models : [];
        const contactPlayerIdentity = getContactPlayerIdentity();
        $('pkmn-contact-settings-body').innerHTML = `
            <div class="wechat-setting-card contact-player-profile-card">
                <div class="wechat-setting-title">玩家资料</div>
                <label class="pkmn-label">玩家昵称
                    <input class="pkmn-input" id="contact-player-nickname" value="${esc(getContactPlayerNickname())}" placeholder="例如：阿杰">
                </label>
                <label class="pkmn-label" style="margin-top:9px;display:block">玩家身份
                    <textarea class="pkmn-textarea" id="contact-player-identity" rows="3" placeholder="例如：宝可梦训练家、沼王饲养员……">${esc(contactPlayerIdentity)}</textarea>
                </label>
                <div class="pkmn-small" style="margin-top:6px">微信/通讯录独立资料。聊天界面显示“玩家昵称”，AI 会同时读取“玩家身份”；两者都不与论坛玩家资料同步。</div>
                <button class="pkmn-btn pkmn-primary" id="contact-save-player-identity" style="margin-top:8px;width:100%">保存玩家资料</button>
            </div>
            <div class="wechat-setting-card">
                <div class="wechat-setting-title">AI 接口</div>
                <label>API Endpoint<input class="pkmn-input" id="contact-api-endpoint" value="${esc(c.endpoint)}" placeholder="https://.../v1"></label>
                <label>API Key<input class="pkmn-input" id="contact-api-key" type="password" value="${esc(c.key)}" placeholder="留空则不发送 Authorization"></label>
                <label>模型<select class="pkmn-select" id="contact-api-model">${models.map(m => `<option value="${esc(m)}" ${m===c.model?'selected':''}>${esc(m)}</option>`).join('')}${c.model && !models.includes(c.model) ? `<option selected value="${esc(c.model)}">${esc(c.model)}</option>` : ''}</select></label>
                <div class="pkmn-row" style="margin-top:8px"><button class="pkmn-btn pkmn-secondary" id="contact-test-api">🔌 检测连接</button><button class="pkmn-btn pkmn-secondary" id="contact-load-models">📥 加载模型</button></div>
                <button class="pkmn-btn pkmn-primary" id="contact-save-api" style="margin-top:8px;width:100%">💾 保存 API 设置</button>
                <div class="pkmn-small" id="contact-api-status" style="margin-top:8px">${models.length ? '● 已有模型缓存' : '● 未检测'}</div>
                <div class="pkmn-row"><label>温度<input class="pkmn-input" id="contact-api-temp" value="${esc(c.temperature)}"></label><label>最大回复<input class="pkmn-input" id="contact-api-max" value="${esc(c.maxTokens)}"></label></div>
            </div>
            <div class="wechat-setting-card contact-settings-link-card">
                <div class="contact-settings-section-title"><span class="contact-settings-icon">◎</span> 论坛内容读取</div>
                <label class="contact-settings-toggle-row" for="contact-read-forum-all">
                    <span>
                        <b>读取论坛全部内容</b>
                        <small>开启后，通讯录 AI 回复时可额外读取论坛的帖子、评论和回复；关闭后仅使用当前聊天、正文和世界书等允许的上下文。</small>
                    </span>
                    <input type="checkbox" id="contact-read-forum-all" ${c.readForumAll !== false ? 'checked' : ''}>
                    <i aria-hidden="true"></i>
                </label>
                <div class="contact-settings-persist">ⓘ 此开关为通讯录全局设置，默认开启，修改后立即保存，下次打开仍保持当前状态。</div>
            </div>
            <div class="wechat-setting-card">
                <div class="wechat-setting-title">通讯录 AI 提示词</div>
                <textarea class="pkmn-textarea" id="contact-system-prompt" style="min-height:220px">${esc(c.systemPrompt)}</textarea>
                <button class="pkmn-btn pkmn-primary" id="contact-save-settings" style="margin-top:10px;width:100%">保存通讯录设置</button>
            </div>
            <div class="wechat-setting-card">
                <div class="wechat-setting-title">联系人</div>
                <div class="pkmn-small">联系人资料和聊天记录独立保存，不影响论坛 API。默认没有预置联系人。</div>
                <button class="pkmn-btn pkmn-secondary" id="contact-add-inline" style="margin-top:10px;width:100%">添加联系人</button>
            </div>`;
        $('contact-read-forum-all').onchange = (e) => {
            c.readForumAll = !!e.target.checked;
            saveContactConfig();
            showToast(c.readForumAll ? '✓ 已开启读取论坛全部内容' : '✓ 已关闭读取论坛全部内容');
        };
        $('contact-save-player-identity').onclick = () => {
            setContactPlayerNickname($('contact-player-nickname').value.trim());
            setContactPlayerIdentity($('contact-player-identity').value.trim());
            showToast('✓ 微信玩家资料已保存');
            renderChat();
        };
        const readContactApiFields = () => {
            c.endpoint=$('contact-api-endpoint').value.trim();
            c.key=$('contact-api-key').value.trim();
            c.model=$('contact-api-model').value.trim();
            c.temperature=Number($('contact-api-temp').value)||0.85;
            c.maxTokens=Math.max(100,Number($('contact-api-max').value)||900);
        };
        $('contact-save-api').onclick = () => {
            readContactApiFields();
            saveContactConfig();
            showToast('✓ API 设置已保存');
        };
        $('contact-save-settings').onclick = () => {
            readContactApiFields();
            c.systemPrompt=$('contact-system-prompt').value;
            c.readForumAll = !!$('contact-read-forum-all').checked;
            saveContactConfig();
            showToast('通讯录设置已保存');
        };
        $('contact-test-api').onclick = async () => {
            try {
                c.endpoint=$('contact-api-endpoint').value.trim(); c.key=$('contact-api-key').value.trim(); saveContactConfig();
                await contactTestConnection(); $('contact-api-status').textContent='● 连接正常'; showToast('✓ 通讯录 API 连接成功');
            } catch(e) { $('contact-api-status').textContent='● 检测失败'; showToast('✕ 连接失败：'+(e.message||e)); }
        };
        $('contact-load-models').onclick = async () => {
            try {
                c.endpoint=$('contact-api-endpoint').value.trim(); c.key=$('contact-api-key').value.trim(); saveContactConfig();
                const ms=await loadContactModels(); showToast('✓ 已加载 '+ms.length+' 个模型');
            } catch(e) { showToast('✕ 加载模型失败：'+(e.message||e)); }
        };
        $('contact-add-inline').onclick = addContact;
    }

    async function addContact() {
        const nameInput = prompt('联系人昵称');
        const name = String(nameInput || '').trim();
        if (!name) return;
        const existing = contactByNickname(name);
        if (existing) { showToast('该联系人已存在'); return; }

        const progressModal = showContactAddProgress('正在检查当前论坛记录…');
        try {
            // 通讯录添加联系人：先读取当前角色卡聊天的论坛资料，再综合世界书、正文与论坛实际行为进行道德检定。
            const forumEvidence = forumMoralEvidenceForUser(name);
            const moral = await assessContactMoral({name, bio:'', location:'', sourcePost:null, onProgress: updateContactAddProgress});
            const id = 'c_' + Date.now() + '_' + Math.floor(Math.random()*10000);
            config.contacts.push({
                id, nickname:name, name, avatar:'👤', note:'', bio:'', location:'', linkForum:true,
                moralScore:moral.score, moralLabel:moral.label, moralStage:moral.stage,
                moralLoyalty:moral.loyalty, moralAffinity:moral.affinity, moralReason:moral.reason,
                moralEvidence:forumEvidence.slice(0,30000)
            });
            config.contactChats[id] = [];
            saveContactConfig();
            renderContacts();
            hideContactAddProgress();
            showToast(`已添加联系人：${name}`);
        } catch (e) {
            hideContactAddProgress();
            showToast('添加联系人失败：' + (e?.message || e));
        }
    }

    // ============================================================
    // 事件
    // ============================================================

    $('pkmn-open-contacts')?.addEventListener('click', () => { renderContacts(); openView('contacts'); });
    $('pkmn-contacts-back')?.addEventListener('click', () => openView('home'));
    $('pkmn-contacts-add')?.addEventListener('click', addContact);
    $('pkmn-contact-search')?.addEventListener('input', e => renderContacts(e.target.value));
    $('pkmn-chat-back')?.addEventListener('click', () => { renderContacts(); openView('contacts'); });
    $('pkmn-chat-send')?.addEventListener('click', sendContactMessage);
    $('pkmn-chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendContactMessage(); }
    });
    $('pkmn-contact-settings')?.addEventListener('click', () => { renderContactSettings(); openView('contactSettings'); });
    $('pkmn-chat-more')?.addEventListener('click', () => openCurrentContactSettings());
    $('pkmn-contact-settings-back')?.addEventListener('click', () => { renderContacts(); openView('contacts'); });
    $('pkmn-contact-person-settings-back')?.addEventListener('click', () => { renderChat(); openView('chat'); });

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
        // CSS 中默认定位使用了 !important；这里必须用同等级的 inline
        // !important，否则拖动后坐标会再次被 right/bottom 规则覆盖。
        floatBtn.style.setProperty('left', pos.left + 'px', 'important');
        floatBtn.style.setProperty('top', pos.top + 'px', 'important');
        floatBtn.style.setProperty('right', 'auto', 'important');
        floatBtn.style.setProperty('bottom', 'auto', 'important');
        floatBtn.style.setProperty('position', 'fixed', 'important');
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

    // 洛托姆悬浮窗作为唯一关闭/打开按键：单击打开，再单击关闭。
    function onFloatButtonActivate() {
        const now = Date.now();
        try { floatBtn._pkmnLastActivate = now; } catch (_) {}
        if (panel.classList.contains('show')) {
            closePhone();
        } else {
            openPhone();
        }
    }

    function openPhone() {
        try {
            panel.classList.add('show');
            panel.style.setProperty('pointer-events', 'auto', 'important');
            panel.style.setProperty('display', 'flex', 'important');
        } catch (_) {}
        try { openView('home'); } catch (_) {}
        try {
            // QQ/酒馆可能在手机关闭期间已经切换聊天；打开时强制以当前聊天为准。
            const k = getChatKey();
            if (k && k !== 'fallback:unknown') {
                // 强制按当前聊天重载（即使用同 key 也合并存档）
                if (k !== chatState.chatKey) {
                    switchChat(k, true);
                } else {
                    const local = loadChatState(k);
                    if (threadCount(local) > threadCount(chatState)) chatState = local;
                    try { loadFromChatMetadata(k); } catch (_) {}
                    chatState.chatKey = k;
                    normalizeForumState(chatState);
                    renderForumList();
                }
                lastChatKey = k;
            } else {
                switchChat();
            }
        } catch (_) {}
    }

    function closePhone() {
        panel.classList.remove('show');
        try {
            panel.style.setProperty('display', 'none', 'important');
            panel.style.setProperty('pointer-events', 'none', 'important');
        } catch (_) {}
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


    // ============================================================
    // v0.55：洛托姆悬浮按钮拖动引擎（彻底重写）
    // ============================================================
    // 旧版同时混用 mouse / pointer / touch，并在不同 window 上监听。
    // Android WebView 下很容易出现“能点但拖不动”。
    // 本版只把一次手势视为一个 drag session：
    //   1. Pointer Events 优先，并尝试 setPointerCapture
    //   2. Android Touch Events 作为独立兜底
    //   3. document + window 双层监听，手指离开按钮后仍能移动
    //   4. 拖动超过 6px 才算移动；未移动才执行打开/关闭
    // ============================================================

    // ============================================================
    // v0.56：洛托姆悬浮按钮拖动引擎（重新设计）
    // 不再依赖“按钮自身一定能收到 move”这一假设。
    // 触摸开始/移动/结束统一在 document 捕获阶段接管，
    // 同时使用 Pointer Events 与 Touch Events 兜底。
    // ============================================================
    let floatDrag = null;
    let floatTouchHandled = false;

    function floatEventPoint(e) {
        if (e && e.touches && e.touches.length) {
            const t = e.touches[0];
            return { x:t.clientX, y:t.clientY, id:t.identifier };
        }
        if (e && e.changedTouches && e.changedTouches.length) {
            const t = e.changedTouches[0];
            return { x:t.clientX, y:t.clientY, id:t.identifier };
        }
        return {
            x:Number(e && e.clientX) || 0,
            y:Number(e && e.clientY) || 0,
            id:e && e.pointerId != null ? e.pointerId : null
        };
    }

    function isFloatTarget(e) {
        const t = e && e.target;
        if (!t) return false;
        if (t === floatBtn) return true;
        try {
            return !!(t.closest && t.closest('#pkmn-float-btn') === floatBtn);
        } catch (_) {
            return false;
        }
    }

    function beginFloatSession(e, kind) {
        if (!isFloatTarget(e)) return false;
        if (kind === 'pointer' && e.isPrimary === false) return false;
        if (kind === 'mouse' && e.button !== 0) return false;
        if (floatDrag) return true;

        const p = floatEventPoint(e);
        const r = floatBtn.getBoundingClientRect();
        floatDrag = {
            kind,
            id:p.id,
            x0:p.x,
            y0:p.y,
            left0:r.left,
            top0:r.top,
            moved:false
        };
        floatBtn.classList.add('dragging');
        try {
            if (kind === 'pointer' && floatBtn.setPointerCapture) {
                floatBtn.setPointerCapture(e.pointerId);
            }
        } catch (_) {}
        if (e.cancelable) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
        return true;
    }

    function moveFloatSession(e, kind) {
        if (!floatDrag || floatDrag.kind !== kind) return false;
        if (kind === 'pointer' && floatDrag.id !== null && e.pointerId !== floatDrag.id) return false;

        const p = floatEventPoint(e);
        if (kind === 'touch') {
            let found = null;
            const list = e.touches || [];
            for (let i=0;i<list.length;i++) {
                if (list[i].identifier === floatDrag.id) { found=list[i]; break; }
            }
            if (!found) return false;
            p.x = found.clientX; p.y = found.clientY;
        }

        const dx = p.x - floatDrag.x0;
        const dy = p.y - floatDrag.y0;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) floatDrag.moved = true;

        if (floatDrag.moved) {
            applyFloatPosition(floatDrag.left0 + dx, floatDrag.top0 + dy);
        }
        if (e.cancelable) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
        return true;
    }

    function endFloatSession(e, kind, activate) {
        if (!floatDrag || floatDrag.kind !== kind) return false;
        if (kind === 'pointer' && floatDrag.id !== null && e.pointerId !== floatDrag.id) return false;

        const moved = floatDrag.moved;
        const pid = floatDrag.id;
        floatDrag = null;
        floatBtn.classList.remove('dragging');
        try {
            if (kind === 'pointer' && floatBtn.releasePointerCapture && pid != null) {
                floatBtn.releasePointerCapture(pid);
            }
        } catch (_) {}
        try { saveFloatPosition(); } catch (_) {}

        if (e && e.cancelable) e.preventDefault();
        if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e && e.stopPropagation) e.stopPropagation();

        if (activate && !moved) {
            setTimeout(() => {
                try { onFloatButtonActivate(); } catch (_) {}
            }, 0);
        }
        return true;
    }

    const floatEventWin = (topDoc && topDoc.defaultView) || window;

    // Pointer Events：鼠标和支持 Pointer Events 的触摸设备优先走这里。
    floatBtn.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') floatTouchHandled = true;
        beginFloatSession(e, 'pointer');
    }, {capture:true, passive:false});
    floatEventWin.addEventListener('pointermove', e => {
        if (floatDrag && floatDrag.kind === 'pointer') moveFloatSession(e, 'pointer');
    }, {capture:true, passive:false});
    floatEventWin.addEventListener('pointerup', e => {
        if (floatDrag && floatDrag.kind === 'pointer') endFloatSession(e, 'pointer', true);
    }, {capture:true, passive:false});
    floatEventWin.addEventListener('pointercancel', e => {
        if (floatDrag && floatDrag.kind === 'pointer') endFloatSession(e, 'pointer', false);
    }, {capture:true, passive:false});

    // Touch Events：Android WebView 兜底。直接在 document 捕获阶段判断触摸目标，
    // 即使按钮内部 SVG/酒馆滚动层改变了事件 target，也能接管整个手势。
    topDoc.addEventListener('touchstart', e => {
        if (!isFloatTarget(e)) return;
        floatTouchHandled = true;
        beginFloatSession(e, 'touch');
    }, {capture:true, passive:false});
    topDoc.addEventListener('touchmove', e => {
        if (floatDrag && floatDrag.kind === 'touch') moveFloatSession(e, 'touch');
    }, {capture:true, passive:false});
    topDoc.addEventListener('touchend', e => {
        if (floatDrag && floatDrag.kind === 'touch') endFloatSession(e, 'touch', true);
        floatTouchHandled = false;
    }, {capture:true, passive:false});
    topDoc.addEventListener('touchcancel', e => {
        if (floatDrag && floatDrag.kind === 'touch') endFloatSession(e, 'touch', false);
        floatTouchHandled = false;
    }, {capture:true, passive:false});

    // Mouse：不支持 Pointer Events 的桌面 WebView。
    floatBtn.addEventListener('mousedown', e => beginFloatSession(e, 'mouse'), {capture:true, passive:false});
    floatEventWin.addEventListener('mousemove', e => {
        if (floatDrag && floatDrag.kind === 'mouse') moveFloatSession(e, 'mouse');
    }, {capture:true, passive:false});
    floatEventWin.addEventListener('mouseup', e => {
        if (floatDrag && floatDrag.kind === 'mouse') endFloatSession(e, 'mouse', true);
    }, {capture:true, passive:false});

    // 阻止浏览器生成第二次 click；真正的打开/关闭只由 endFloatSession 决定。
    floatBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }, {capture:true, passive:false});

    // 窗口尺寸变化时把按钮拉回可见区
    window.addEventListener('resize', function () {
        try {
            const rect = floatBtn.getBoundingClientRect();
            applyFloatPosition(rect.left, rect.top);
            saveFloatPosition();
        } catch (_) {}
    });

    // 定时保证按钮在最上层（防止被酒馆 UI 盖住）
    trackedSetInterval(function () {
        try {
            if (!floatBtn.isConnected) {
                topDoc.body.appendChild(floatBtn);
            }
            // 移到 body 最后，提高叠放顺序
            if (floatBtn.parentNode === topDoc.body && topDoc.body.lastElementChild !== floatBtn && topDoc.body.lastElementChild !== panel) {
                topDoc.body.appendChild(floatBtn);
            }
            floatBtn.style.setProperty('z-index', '2147483646', 'important');
            floatBtn.style.setProperty('pointer-events', 'auto', 'important');
            floatBtn.style.setProperty('display', 'flex', 'important');
            floatBtn.style.setProperty('visibility', 'visible', 'important');
            floatBtn.style.setProperty('opacity', '1', 'important');
        } catch (_) {}
    }, 2000);

    restoreFloatPosition();
    // 某些 Android WebView 首帧 innerHeight 仍未稳定；下一帧再校正一次，
    // 防止手机窗口初次打开时出现在屏幕外。
    try {
        (topDoc.defaultView || window).requestAnimationFrame(() => {
            if (!panel.classList.contains('show')) centerPhoneInitial();
            else resizePhonePreservePosition();
        });
    } catch (_) {}

    // 手机内部不再显示独立 X；关闭功能统一交给洛托姆悬浮窗。
    ['pointerdown','pointerup','click'].forEach(type => {
        panel.addEventListener(type, e => {
            e.stopPropagation();
        }, { passive: false });
    });

    restoreFloatPosition();


    // ============================================================
    // 自动聊天切换 / 新建聊天
    // ============================================================

    if (TH.eventOn) {
        try {
            const ctx0 = getSTContext();
            const types0 = (ctx0 && ctx0.eventTypes) || {};
            const changedEv = types0.CHAT_CHANGED ||
                ((typeof tavern_events !== 'undefined' && tavern_events.CHAT_CHANGED) ? tavern_events.CHAT_CHANGED : 'CHAT_CHANGED');
            const createdEv = types0.CHAT_CREATED ||
                ((typeof tavern_events !== 'undefined' && tavern_events.CHAT_CREATED) ? tavern_events.CHAT_CREATED : 'CHAT_CREATED');

            const resolveIncomingChatKey = (arg) => {
                if (arg !== undefined && arg !== null && arg !== '') {
                    if (typeof arg === 'string' || typeof arg === 'number') return 'chat:' + String(arg);
                    if (typeof arg === 'object') {
                        const id = arg.chatId ?? arg.id ?? arg.chat_id ?? arg.file_name;
                        if (id !== undefined && id !== null && String(id) !== '') return 'chat:' + String(id);
                    }
                }
                return getChatKey();
            };

            // 注意：CHAT_CHANGED 刚触发时 getChatKey() 可能仍是旧 id。
            // 必须优先使用事件参数里的新 chatId，稍后用 live 再校正一次。
            TH.eventOn(changedEv, (newChatId) => {
                console.log('[pkmn-forum] CHAT_CHANGED arg=', newChatId, 'live=', getChatKey());
                const trySwitch = (attempt) => {
                    const fromEvent = resolveIncomingChatKey(newChatId);
                    const live = getChatKey();
                    let finalKey;
                    if (attempt === 0) {
                        // 第一次：事件参数优先
                        finalKey = (fromEvent && fromEvent !== 'fallback:unknown') ? fromEvent : live;
                    } else {
                        // 后续：ST 已稳定，以 live 为准
                        finalKey = (live && live !== 'fallback:unknown') ? live : fromEvent;
                    }
                    if (!finalKey || finalKey === 'fallback:unknown') return;
                    switchChat(finalKey, true);
                    lastChatKey = finalKey;
                };
                // SillyTavern/QQ 在切换聊天时，事件触发与当前 chatId 更新可能不同步。
                // 多阶段校正，确保论坛档案跟随“新聊天”而不是继续显示旧聊天。
                [30, 120, 300, 650, 1200, 1800].forEach(delay => {
                    setTimeout(() => trySwitch(delay === 30 ? 0 : 1), delay);
                });
            });

            TH.eventOn(createdEv, (newChatId) => {
                console.log('[pkmn-forum] CHAT_CREATED arg=', newChatId);
                setTimeout(() => {
                    const fromEvent = (newChatId != null && newChatId !== '')
                        ? 'chat:' + String(newChatId)
                        : null;
                    const live = getChatKey();
                    const key = (fromEvent && fromEvent !== 'fallback:unknown')
                        ? fromEvent
                        : live;
                    if (!key || key === 'fallback:unknown') return;
                    const existing = loadChatState(key);
                    if (threadCount(existing) > 0) {
                        switchChat(key, true);
                    } else {
                        const id = key.startsWith('chat:') ? key.slice(5) : newChatId;
                        resetForumForNewChat(id);
                        try { switchContactChat('chat:' + String(id), { silent: true }); } catch (e) { console.warn('[pkmn-forum] contact new-chat switch failed', e); }
                    }
                    lastChatKey = key;
                }, 300);
            });
        } catch (e) {
            console.warn('[pkmn-forum] event bind failed', e);
        }
    }

    lastChatKey = getChatKey();
    trackedSetInterval(() => {
        try {
            const k = getChatKey();
            if (k && k !== 'fallback:unknown' && k !== lastChatKey) {
                console.log('[pkmn-forum] poll chat change', lastChatKey, '=>', k);
                switchChat(k, true);
                lastChatKey = k;
            } else if (k && k !== 'fallback:unknown') {
                lastChatKey = k;
                if (chatState && threadCount(chatState) > 0 && chatState.chatKey === k) {
                    persistLocalOnly(k, chatState);
                }
            }
        } catch (e) {
            console.warn('[pkmn-forum] chat poll error', e);
        }
    }, 350);


    // ============================================================
    // 时间
    // ============================================================
    function updatePhoneClock() {
        const el = $('pkmn-time');
        if (!el) return;
        const d = new Date();
        el.textContent =
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    }

    updatePhoneClock();
    trackedSetInterval(updatePhoneClock, 1000);


    // ============================================================
    // 初始载入
    // ============================================================

    try { switchContactChat(getChatKey(), { silent: true }); } catch (e) { console.warn('[pkmn-forum] initial contact chat load failed', e); }
    try {
        chatState = loadChatState(getChatKey()) || makeChatState();
    } catch (e) {
        console.warn('[pkmn-forum] loadChatState failed', e);
        try { chatState = makeChatState(); } catch (e2) {
            chatState = { version: VERSION, chatKey: 'fallback:unknown', safeThreads: [], matureThreads: [], counters: {}, lastRefresh: {}, updatedAt: Date.now() };
        }
    }
    if (!chatState) {
        chatState = { version: VERSION, chatKey: 'fallback:unknown', safeThreads: [], matureThreads: [], counters: {}, lastRefresh: {}, updatedAt: Date.now() };
    }
    try { loadFromChatMetadata(); } catch (e) { console.warn('[pkmn-forum] loadFromChatMetadata', e); }
    try { normalizeForumState(chatState); } catch (_) {}
    try { normalizeForumThreads(); } catch (e) { console.warn('[pkmn-forum] normalizeForumThreads', e); }
    try { renderForumList(); } catch (e) { console.warn('[pkmn-forum] renderForumList', e); }


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
        '[宝可梦小手机论坛] 已启动 v' + VERSION + ' | 聊天：',
        chatState.chatKey
    );

    }); // end whenReady

})();