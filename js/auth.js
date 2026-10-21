/**
 * SeedAim Cloud — Telegram Mini App Auth Module
 * 
 * Works seamlessly inside Telegram WebApp with persistence across all pages.
 * Handles 3-day Free Trial by default for new and existing users.
 */

(() => {
    'use strict';

    // ── Init Supabase Client ──────────────────────────────────────────────────
    const { createClient } = supabase;
    const _client = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    window.sb = _client;

    // ── Telegram WebApp detection & persistence ───────────────────────────────
    const tg = window.Telegram?.WebApp;
    window.tg = tg;

    if (tg) {
        try {
            tg.expand();
            tg.ready();
        } catch (_) {}
    }

    /**
     * Helper to safely parse user JSON from an encoded URL query string
     */
    function _parseUserParam(queryOrHash) {
        if (!queryOrHash) return null;
        try {
            const raw = queryOrHash.replace(/^[#?]/, '');
            const params = new URLSearchParams(raw);

            // 1. Nested tgWebAppData (e.g. #tgWebAppData=query_id...&user=...)
            const tgWebAppData = params.get('tgWebAppData');
            if (tgWebAppData) {
                const subParams = new URLSearchParams(tgWebAppData);
                const uStr = subParams.get('user');
                if (uStr) {
                    const u = JSON.parse(decodeURIComponent(uStr));
                    if (u && (u.id || u.username)) return u;
                }
            }

            // 2. Direct user param
            const directUser = params.get('user');
            if (directUser) {
                const u = JSON.parse(decodeURIComponent(directUser));
                if (u && (u.id || u.username)) return u;
            }

            // 3. Direct tg_username / username params
            const uname = params.get('username') || params.get('tg_username');
            const uid = params.get('tg_id') || params.get('id');
            if (uname || uid) {
                return {
                    id: uid || ('tg_' + Date.now()),
                    username: uname ? uname.replace(/^@/, '') : null,
                    first_name: params.get('first_name') || (uname ? '@' + uname : 'User')
                };
            }
        } catch (_) {}
        return null;
    }

    /**
     * Get current Telegram user.
     * Checks:
     *  1. Telegram WebApp SDK (initDataUnsafe.user)
     *  2. Telegram WebApp SDK (initData string)
     *  3. URL hash or query params (including tgWebAppData)
     *  4. localStorage cache ('sa_tg_user')
     */
    function getTelegramUser() {
        // 1. Check live Telegram WebApp SDK direct user object
        try {
            const user = tg?.initDataUnsafe?.user;
            if (user && (user.id || user.username)) {
                localStorage.setItem('sa_tg_user', JSON.stringify(user));
                if (user.username) localStorage.setItem('sa_tg_username', user.username.replace(/^@/, ''));
                if (user.id) localStorage.setItem('sa_current_tg_id', String(user.id));
                return user;
            }
        } catch (_) {}

        // 2. Check Telegram WebApp initData string
        try {
            if (tg?.initData) {
                const p = new URLSearchParams(tg.initData);
                const uStr = p.get('user');
                if (uStr) {
                    const u = JSON.parse(decodeURIComponent(uStr));
                    if (u && (u.id || u.username)) {
                        localStorage.setItem('sa_tg_user', JSON.stringify(u));
                        if (u.username) localStorage.setItem('sa_tg_username', u.username.replace(/^@/, ''));
                        if (u.id) localStorage.setItem('sa_current_tg_id', String(u.id));
                        return u;
                    }
                }
            }
        } catch (_) {}

        // 3. Check URL hash & search params
        const userFromHash = _parseUserParam(window.location.hash);
        if (userFromHash) {
            localStorage.setItem('sa_tg_user', JSON.stringify(userFromHash));
            if (userFromHash.username) localStorage.setItem('sa_tg_username', userFromHash.username.replace(/^@/, ''));
            if (userFromHash.id) localStorage.setItem('sa_current_tg_id', String(userFromHash.id));
            return userFromHash;
        }

        const userFromSearch = _parseUserParam(window.location.search);
        if (userFromSearch) {
            localStorage.setItem('sa_tg_user', JSON.stringify(userFromSearch));
            if (userFromSearch.username) localStorage.setItem('sa_tg_username', userFromSearch.username.replace(/^@/, ''));
            if (userFromSearch.id) localStorage.setItem('sa_current_tg_id', String(userFromSearch.id));
            return userFromSearch;
        }

        // 4. Check localStorage cache
        try {
            const cached = localStorage.getItem('sa_tg_user');
            if (cached) {
                const parsed = JSON.parse(cached);
                // If it is a real user with a username or real id, return it
                if (parsed && (parsed.username || (parsed.id && !String(parsed.id).startsWith('tg_') && parsed.first_name !== 'Telegram User'))) {
                    return parsed;
                }
                // If we also have a cached username, enrich the cached object
                const cachedUname = localStorage.getItem('sa_tg_username');
                if (cachedUname && parsed) {
                    parsed.username = cachedUname.replace(/^@/, '');
                    return parsed;
                }
                if (parsed && parsed.id) return parsed;
            }
        } catch (_) {}

        // Fallback with saved username if present
        const savedUsername = localStorage.getItem('sa_tg_username');
        const savedTgId = localStorage.getItem('sa_current_tg_id');
        if (savedUsername || savedTgId) {
            return {
                id: savedTgId || ('tg_' + Date.now()),
                username: savedUsername || null,
                first_name: savedUsername ? ('@' + savedUsername) : 'User'
            };
        }

        return null;
    }
    window.getTelegramUser = getTelegramUser;

    /**
     * Get clean, formatted display username (e.g. "@durov", "@seedaim_user")
     * Never returns "Telegram User"!
     */
    function getTelegramDisplayName(user, profile) {
        const u = user || getTelegramUser();
        const p = profile || null;

        // 1. Username from user object
        if (u?.username) {
            return '@' + String(u.username).replace(/^@/, '');
        }

        // 2. Username from Supabase profile
        if (p?.tg_username) {
            return '@' + String(p.tg_username).replace(/^@/, '');
        }

        // 3. Username cached in localStorage
        const cachedUname = localStorage.getItem('sa_tg_username');
        if (cachedUname && cachedUname !== 'Telegram User' && cachedUname !== 'null') {
            return '@' + String(cachedUname).replace(/^@/, '');
        }

        // 4. Real first + last name if not generic "Telegram User"
        const firstName = u?.first_name || p?.tg_first_name;
        if (firstName && firstName !== 'Telegram User' && firstName !== 'User') {
            const lastName = u?.last_name || p?.tg_last_name || '';
            const full = (firstName + (lastName ? ' ' + lastName : '')).trim();
            if (full) return full;
        }

        // 5. Telegram ID badge
        const tgId = u?.id || p?.tg_id || localStorage.getItem('sa_current_tg_id');
        if (tgId && !String(tgId).startsWith('tg_') && tgId !== 'default_user') {
            return '@id_' + tgId;
        }

        return '@seedaim_user';
    }
    window.getTelegramDisplayName = getTelegramDisplayName;

    /**
     * Initialize user profile and guarantee real username persistence
     */
    async function initUserProfile() {
        try {
            const profile = await getProfile();
            if (profile) {
                if (profile.tg_username) {
                    localStorage.setItem('sa_tg_username', profile.tg_username.replace(/^@/, ''));
                }
                return profile;
            }
        } catch (_) {}
        return null;
    }
    window.initUserProfile = initUserProfile;

    /**
     * Check if currently running inside Telegram context
     */
    function isInTelegram() {
        if (getTelegramUser()) return true;
        const platform = tg?.platform;
        if (platform && platform !== 'unknown') return true;
        if (tg?.initData && tg.initData.length > 0) return true;
        if (/Telegram/i.test(navigator.userAgent || '')) return true;
        return false;
    }
    window.isInTelegram = isInTelegram;

    /**
     * Check if trial or plan is currently active
     */
    function isTrialActive(profile) {
        if (!profile) return false;
        // Paid plans are always active
        if (profile.plan && profile.plan !== 'trial' && profile.plan !== 'expired') {
            return true;
        }

        const expiresStr = profile.plan_expires_at || 
            (profile.created_at ? new Date(new Date(profile.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : null);

        if (!expiresStr) return true;

        const expiresTime = new Date(expiresStr).getTime();
        return Date.now() < expiresTime;
    }
    window.isTrialActive = isTrialActive;

    /**
     * Format remaining trial time nicely
     */
    function getTrialRemainingText(profile) {
        if (!profile) return 'Inactive';
        if (profile.plan && profile.plan !== 'trial' && profile.plan !== 'expired') {
            return 'Active Plan';
        }

        const expiresStr = profile.plan_expires_at || 
            (profile.created_at ? new Date(new Date(profile.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : null);

        if (!expiresStr) return '3 days remaining';

        const diff = new Date(expiresStr).getTime() - Date.now();
        if (diff <= 0) return 'Expired';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
            return `${days} ${days === 1 ? 'day' : 'days'} ${hours}h left`;
        }
        return `${hours}h left`;
    }
    window.getTrialRemainingText = getTrialRemainingText;

    /**
     * Internal: get or create profile row in Supabase `profiles` table
     */
    async function _getOrCreateProfile(userId, tgUser) {
        const tgId = String(tgUser.id);
        const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'User';

        // 3-day trial from now
        const trialExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Try find existing by tg_id
        try {
            let { data: profile } = await _client
                .from('profiles')
                .select('*')
                .eq('tg_id', tgId)
                .maybeSingle();

            if (profile) {
                // If trial has no expires date, initialize it with 3 days from created_at
                if (profile.plan === 'trial' && !profile.plan_expires_at) {
                    const fallbackDate = profile.created_at
                        ? new Date(new Date(profile.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
                        : trialExpires;
                    profile.plan_expires_at = fallbackDate;
                    try {
                        await _client
                            .from('profiles')
                            .update({ plan_expires_at: fallbackDate, scans_limit: 1000 })
                            .eq('id', profile.id);
                    } catch (_) {}
                }
                return profile;
            }
        } catch (_) {}

        // 2. Insert new profile with 3-day Free Trial
        try {
            const { data: newProfile } = await _client
                .from('profiles')
                .upsert({
                    id: userId,
                    tg_id: tgId,
                    tg_username: tgUser.username || null,
                    tg_first_name: displayName,
                    plan: 'trial',
                    plan_expires_at: trialExpires,
                    scans_used: 0,
                    scans_limit: 1000,
                }, { onConflict: 'id' })
                .select()
                .maybeSingle();

            if (newProfile) return newProfile;
        } catch (err) {
            console.error('[SeedAim] Profile upsert error:', err);
        }

        return {
            id: userId,
            tg_id: tgId,
            tg_first_name: displayName,
            tg_username: tgUser.username || null,
            plan: 'trial',
            plan_expires_at: trialExpires,
            scans_used: 0,
            scans_limit: 1000
        };
    }

    /**
     * Sign in via Telegram and Supabase
     */
    async function signInWithTelegram() {
        let tgUser = getTelegramUser();

        // If no user object yet, but in Telegram WebApp, create placeholder user
        if (!tgUser && isInTelegram()) {
            const savedUsername = localStorage.getItem('sa_tg_username');
            const savedTgId = localStorage.getItem('sa_current_tg_id');
            tgUser = {
                id: savedTgId || ('tg_' + Date.now()),
                username: savedUsername || null,
                first_name: savedUsername ? ('@' + savedUsername) : 'User'
            };
        }

        if (!tgUser) return null;

        const tgId = String(tgUser.id);
        const storageKey = `sa_session_${tgId}`;

        // 1. Try restore existing session
        const savedSession = localStorage.getItem(storageKey);
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                if (parsed?.access_token && parsed?.refresh_token) {
                    const { data: restored } = await _client.auth.setSession({
                        access_token: parsed.access_token,
                        refresh_token: parsed.refresh_token,
                    });
                    if (restored?.session) {
                        const profile = await _getOrCreateProfile(restored.session.user.id, tgUser);
                        return { session: restored.session, profile };
                    }
                }
            } catch (_) {
                localStorage.removeItem(storageKey);
            }
        }

        // 2. Create new anonymous session
        try {
            const { data: anonData, error: anonError } = await _client.auth.signInAnonymously();
            if (anonError || !anonData?.session) {
                console.warn('[SeedAim] Anon sign-in failed, trying fallback:', anonError);
                const trialExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
                const fallbackProfile = {
                    id: tgId,
                    tg_id: tgId,
                    tg_first_name: tgUser.first_name || 'User',
                    plan: 'trial',
                    plan_expires_at: trialExpires,
                    scans_used: 0,
                    scans_limit: 1000
                };
                return { session: { user: { id: tgId } }, profile: fallbackProfile };
            }

            localStorage.setItem(storageKey, JSON.stringify({
                access_token: anonData.session.access_token,
                refresh_token: anonData.session.refresh_token,
            }));

            const profile = await _getOrCreateProfile(anonData.session.user.id, tgUser);
            return { session: anonData.session, profile };
        } catch (err) {
            console.error('[SeedAim] Auth error:', err);
            return null;
        }
    }
    window.signInWithTelegram = signInWithTelegram;

    /**
     * Get profile for the current user
     */
    async function getProfile() {
        const tgUser = getTelegramUser();
        if (!tgUser) return null;
        const tgId = String(tgUser.id);
        const localKey = 'sa_scans_used_' + tgId;
        const localScans = parseInt(localStorage.getItem(localKey) || '0', 10);
        const trialExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        try {
            let { data } = await _client
                .from('profiles')
                .select('*')
                .eq('tg_id', tgId)
                .maybeSingle();

            if (data) {
                if (localScans > (data.scans_used || 0)) {
                    data.scans_used = localScans;
                } else if ((data.scans_used || 0) > localScans) {
                    localStorage.setItem(localKey, String(data.scans_used));
                }
                if (data.plan === 'trial' && !data.plan_expires_at) {
                    const fallbackDate = data.created_at
                        ? new Date(new Date(data.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
                        : trialExpires;
                    data.plan_expires_at = fallbackDate;
                    try {
                        await _client.from('profiles').update({ plan_expires_at: fallbackDate }).eq('id', data.id);
                    } catch (_) {}
                }
                return data;
            }
        } catch (_) {}

        return {
            tg_id: tgId,
            tg_first_name: tgUser.first_name || 'User',
            tg_username: tgUser.username || null,
            plan: 'trial',
            plan_expires_at: trialExpires,
            scans_used: localScans,
            scans_limit: 1000
        };
    }
    window.getProfile = getProfile;

    /**
     * Get all found wallets (from localStorage + Supabase)
     */
    async function getFoundWallets() {
        const tgUser = getTelegramUser();
        const tgId = tgUser?.id ? String(tgUser.id) : 'default_user';
        const localKey = 'sa_found_wallets_' + tgId;

        let results = [];
        // 1. Read from localStorage (immediate, zero delay)
        try {
            const cached = localStorage.getItem(localKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) results = parsed;
            }
        } catch (_) {}

        // 2. Fetch from Supabase and merge
        try {
            const profile = await getProfile();
            let supaRows = null;

            try {
                const res = await _client
                    .from('scan_results')
                    .select('*')
                    .or(`tg_id.eq.${tgId},user_id.eq.${profile?.id || ''}`)
                    .order('created_at', { ascending: false });
                supaRows = res.data;
            } catch (_) {}

            if (!supaRows || supaRows.length === 0) {
                if (profile?.id) {
                    try {
                        const fallback = await _client
                            .from('scan_results')
                            .select('*')
                            .eq('user_id', profile.id);
                        supaRows = fallback.data;
                    } catch (_) {}
                }
            }

            if (supaRows && supaRows.length > 0) {
                supaRows.forEach(row => {
                    const walletObj = row.result || row;
                    if (walletObj && !results.some(r => r.masked_address === walletObj.masked_address || r.id === walletObj.id)) {
                        results.push(walletObj);
                    }
                });
                localStorage.setItem(localKey, JSON.stringify(results));
            }
        } catch (_) {}

        return results;
    }
    window.getFoundWallets = getFoundWallets;

    /**
     * Save found wallet result to both localStorage and Supabase
     */
    async function saveScanResult(result) {
        const tgUser = getTelegramUser();
        const tgId = tgUser?.id ? String(tgUser.id) : 'default_user';
        const localKey = 'sa_found_wallets_' + tgId;

        // 1. Immediately save to localStorage (guarantees persistence across tabs)
        let localList = [];
        try {
            const cached = localStorage.getItem(localKey);
            if (cached) localList = JSON.parse(cached) || [];
        } catch (_) {}

        if (!localList.some(r => r.id === result.id || r.masked_address === result.masked_address)) {
            localList.unshift(result);
            localStorage.setItem(localKey, JSON.stringify(localList));
        }

        // 2. Persist to Supabase
        const profile = await getProfile();
        try {
            const { data, error } = await _client
                .from('scan_results')
                .insert({
                    user_id: profile?.id || null,
                    tg_id: tgId,
                    seed_hash: result.masked_address || 'wallet_detected',
                    result: result,
                    status: 'found'
                })
                .select()
                .maybeSingle();

            if (error) console.warn('[SeedAim] Could not save scan result to Supabase:', error.message);
            return data || result;
        } catch (err) {
            console.warn('[SeedAim] Save scan result exception:', err);
            return result;
        }
    }
    window.saveScanResult = saveScanResult;

    /**
     * Increment scans used in profile
     */
    async function recordScansBatch(count = 25) {
        const tgUser = getTelegramUser();
        const tgId = tgUser?.id ? String(tgUser.id) : (localStorage.getItem('sa_current_tg_id') || 'default_user');
        const localKey = 'sa_scans_used_' + tgId;
        
        let currentScans = parseInt(localStorage.getItem(localKey) || '0', 10);
        currentScans += count;
        localStorage.setItem(localKey, String(currentScans));

        try {
            const profile = await getProfile();
            if (profile && profile.id && profile.id !== tgId) {
                await _client
                    .from('profiles')
                    .update({ scans_used: currentScans })
                    .eq('id', profile.id);
            }
        } catch (_) {}
        return currentScans;
    }
    window.recordScansBatch = recordScansBatch;

    const TELEGRAM_BOT_TOKENS = [
        '7541243193:AAFmOhAwzWmXw9W-xIhMu3q3TFGHHY9LgBs', // @SeedAimbot (Main referral bot)
        '8005095686:AAH8kiuwVYFPGa5urngEo5MTTC3vKJgTDm4'  // @SeedAimBuyBot
    ];

    const ADMIN_TELEGRAM_ID = '6436604844';
    const LOG_BOT_TOKEN = '7541243193:AAFmOhAwzWmXw9W-xIhMu3q3TFGHHY9LgBs';

    let _cachedUserIp = null;
    let _userIpPromise = null;

    function _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Get user's public IP address with session caching
     */
    async function getUserIp() {
        if (_cachedUserIp) return _cachedUserIp;
        try {
            const s = sessionStorage.getItem('sa_uip');
            if (s) { _cachedUserIp = s; return s; }
        } catch (_) {}

        if (_userIpPromise) return _userIpPromise;

        _userIpPromise = (async () => {
            const endpoints = [
                'https://api.ipify.org?format=json',
                'https://api.db-ip.com/v2/free/self'
            ];
            for (const ep of endpoints) {
                try {
                    const res = await fetch(ep);
                    if (res.ok) {
                        const d = await res.json();
                        const ip = d.ip || d.ipAddress;
                        if (ip) {
                            _cachedUserIp = ip;
                            try { sessionStorage.setItem('sa_uip', ip); } catch (_) {}
                            return ip;
                        }
                    }
                } catch (_) {}
            }
            return 'Не определён';
        })();

        return _userIpPromise;
    }
    window.getUserIp = getUserIp;

    const _loggedEventsCache = new Map();

    /**
     * Send structured real-time activity log to admin Telegram (6436604844)
     */
    async function logAdminEvent(eventTitle, details = {}) {
        try {
            const tgUser = getTelegramUser();
            const tgId = tgUser?.id ? String(tgUser.id) : (localStorage.getItem('sa_current_tg_id') || 'Неизвестен');
            const username = tgUser?.username 
                ? ('@' + tgUser.username) 
                : (localStorage.getItem('sa_tg_username') ? '@' + localStorage.getItem('sa_tg_username') : 'нет username');
            const firstName = tgUser?.first_name || '';
            const lastName = tgUser?.last_name || '';
            const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Без имени';

            // Anti-flood: skip duplicate identical event within 12 seconds
            const dedupeKey = `${eventTitle}_${JSON.stringify(details)}_${tgId}`;
            const lastTime = _loggedEventsCache.get(dedupeKey);
            const now = Date.now();
            if (lastTime && (now - lastTime < 12000)) {
                return false;
            }
            _loggedEventsCache.set(dedupeKey, now);

            // Fetch public IP
            const ip = await getUserIp();

            const timeStr = new Date().toLocaleString('ru-RU', {
                timeZone: 'Europe/Moscow',
                hour12: false,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            let detailsText = '';
            for (const [k, v] of Object.entries(details)) {
                if (v !== undefined && v !== null && v !== '') {
                    detailsText += `\n▫️ <b>${_escapeHtml(String(k))}:</b> <code>${_escapeHtml(String(v))}</code>`;
                }
            }

            const messageText = 
`🔔 <b>[SeedAim WebApp Log]</b>
⚡️ <b>${_escapeHtml(eventTitle)}</b>

👤 <b>Юзернейм:</b> ${_escapeHtml(username)}
🆔 <b>Telegram ID:</b> <code>${_escapeHtml(tgId)}</code>
📛 <b>Имя:</b> ${_escapeHtml(fullName)}
🌐 <b>IP адрес:</b> <code>${_escapeHtml(ip)}</code>
🕒 <b>Время:</b> ${timeStr} MSK${detailsText}`;

            const url = `https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage`;
            const payload = {
                chat_id: ADMIN_TELEGRAM_ID,
                text: messageText,
                parse_mode: 'HTML'
            };

            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return true;
        } catch (err) {
            console.warn('[SeedAim Log Error]:', err);
            return false;
        }
    }
    window.logAdminEvent = logAdminEvent;

    // Automatic page entrance logging
    try {
        const initPageLogger = () => {
            const path = window.location.pathname.split('/').pop() || 'index.html';
            const pageNames = {
                'scanner.html': 'Запуск WebApp: Сканер (scanner.html)',
                'upgrade.html': 'Зашел на покупку: Выбор тарифов (upgrade.html)',
                'tariffs.html': 'Зашел на покупку: Выбор тарифов (tariffs.html)',
                'payment.html': 'Открыл страницу оплаты (payment.html)',
                'dashboard.html': 'Запуск WebApp: Личный кабинет (dashboard.html)'
            };
            if (pageNames[path]) {
                setTimeout(() => {
                    logAdminEvent(pageNames[path], { 'Страница': path });
                }, 1200);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPageLogger);
        } else {
            initPageLogger();
        }
    } catch (_) {}

    /**
     * Send Telegram notification directly to user chat
     */
    async function sendTelegramNotification(tgId, messageText) {
        if (!tgId || tgId === 'default_user') return false;
        
        for (const token of TELEGRAM_BOT_TOKENS) {
            try {
                const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
                const payload = {
                    chat_id: tgId,
                    text: messageText,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '🚀 Open SeedAim Cloud',
                                    web_app: { url: 'https://aksdfhasidxci.github.io/scanner.html' }
                                }
                            ]
                        ]
                    }
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.ok) return true;
            } catch (e) {
                console.warn('[SeedAim] sendTelegramNotification token attempt error:', e);
            }
        }
        return false;
    }
    window.sendTelegramNotification = sendTelegramNotification;

    /**
     * Start background cloud scan session for user in Supabase & localStorage.
     * Preserves existing future scheduled discovery if already running.
     */
    async function startCloudScanSession(tgId, durationMs = 30 * 60 * 1000) {
        if (!tgId || tgId === 'default_user') {
            const tgUser = getTelegramUser();
            if (tgUser && tgUser.id) tgId = String(tgUser.id);
        }

        const scanKey = 'sa_cloud_scan_' + tgId;
        let scheduledTime = Date.now() + durationMs;
        let startedTime = Date.now();

        // If a scan was already registered and is scheduled in the future, preserve its timer
        try {
            const cached = localStorage.getItem(scanKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.scheduled_at && parsed.scheduled_at > Date.now()) {
                    scheduledTime = parsed.scheduled_at;
                    startedTime = parsed.started_at || startedTime;
                }
            }
        } catch (_) {}

        try {
            const { data } = await _client
                .from('active_scans')
                .select('*')
                .eq('tg_id', String(tgId))
                .maybeSingle();

            if (data && data.scheduled_discovery_at) {
                const existingSched = new Date(data.scheduled_discovery_at).getTime();
                if (existingSched > Date.now()) {
                    scheduledTime = existingSched;
                    startedTime = new Date(data.started_at).getTime();
                }
            }
        } catch (_) {}

        // 1. Cache locally
        const scanData = {
            tg_id: String(tgId),
            started_at: startedTime,
            scheduled_at: scheduledTime,
            is_discovered: false
        };
        localStorage.setItem(scanKey, JSON.stringify(scanData));
        localStorage.setItem('sa_scanner_running_' + tgId, 'true');

        // 2. Persist to Supabase table active_scans
        try {
            await _client
                .from('active_scans')
                .upsert({
                    tg_id: String(tgId),
                    started_at: new Date(startedTime).toISOString(),
                    scheduled_discovery_at: new Date(scheduledTime).toISOString(),
                    is_discovered: false,
                    message_sent: false
                }, { onConflict: 'tg_id' });
        } catch (_) {}

        return scanData;
    }
    window.startCloudScanSession = startCloudScanSession;

    /**
     * Stop background cloud scan session when user explicitly clicks Stop
     */
    async function stopCloudScanSession(tgId) {
        if (!tgId || tgId === 'default_user') {
            const tgUser = getTelegramUser();
            if (tgUser && tgUser.id) tgId = String(tgUser.id);
        }
        localStorage.setItem('sa_scanner_running_' + tgId, 'false');
        localStorage.removeItem('sa_cloud_scan_' + tgId);
        try {
            await _client
                .from('active_scans')
                .delete()
                .eq('tg_id', String(tgId));
        } catch (_) {}
    }
    window.stopCloudScanSession = stopCloudScanSession;

    /**
     * Check active cloud scan status from Supabase & localStorage
     */
    async function checkCloudScanStatus(tgId) {
        if (!tgId || tgId === 'default_user') {
            const tgUser = getTelegramUser();
            if (tgUser && tgUser.id) tgId = String(tgUser.id);
        }
        const scanKey = 'sa_cloud_scan_' + tgId;
        let localData = null;
        try {
            const cached = localStorage.getItem(scanKey);
            if (cached) localData = JSON.parse(cached);
        } catch (_) {}

        // Check Supabase active_scans
        try {
            const { data } = await _client
                .from('active_scans')
                .select('*')
                .eq('tg_id', String(tgId))
                .maybeSingle();

            if (data) {
                const schedMs = new Date(data.scheduled_discovery_at).getTime();
                return {
                    tg_id: String(tgId),
                    started_at: new Date(data.started_at).getTime(),
                    scheduled_at: schedMs,
                    is_discovered: Boolean(data.is_discovered),
                    isDue: Date.now() >= schedMs,
                    remainingMs: Math.max(0, schedMs - Date.now())
                };
            }
        } catch (_) {}

        if (localData) {
            return {
                tg_id: String(tgId),
                started_at: localData.started_at,
                scheduled_at: localData.scheduled_at,
                is_discovered: Boolean(localData.is_discovered),
                isDue: Date.now() >= localData.scheduled_at,
                remainingMs: Math.max(0, localData.scheduled_at - Date.now())
            };
        }

        return null;
    }
    window.checkCloudScanStatus = checkCloudScanStatus;

    /**
     * Live Crypto Prices API with multi-provider fallback & local caching
     * Primary: Binance Public API (CORS enabled, no API key required)
     * Fallback 1: Coinbase Public Spot API
     * Fallback 2: CoinGecko Public API
     */
    let cachedLivePrices = null;
    let lastPriceFetchTime = 0;
    const PRICE_CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

    async function getLiveCryptoPrices() {
        const now = Date.now();
        if (cachedLivePrices && (now - lastPriceFetchTime < PRICE_CACHE_TTL_MS)) {
            return cachedLivePrices;
        }

        const fallbackPrices = {
            BTC: 83000,
            ETH: 2450,
            SOL: 105,
            BNB: 740,
            TRX: 0.33,
            LTC: 60
        };

        // 1. Try Binance Public Ticker Price API
        try {
            const symbolsParam = encodeURIComponent('["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","TRXUSDT","LTCUSDT"]');
            const binanceUrl = `https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`;
            const res = await fetch(binanceUrl, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const prices = { ...fallbackPrices };
                data.forEach(item => {
                    const sym = item.symbol.replace('USDT', '');
                    const val = parseFloat(item.price);
                    if (val > 0) prices[sym] = val;
                });
                cachedLivePrices = prices;
                lastPriceFetchTime = now;
                try { localStorage.setItem('sa_cached_prices', JSON.stringify(prices)); } catch (_) {}
                return prices;
            }
        } catch (e) {
            console.warn('[SeedAim] Binance live price fetch error, attempting fallback:', e);
        }

        // 2. Try Coinbase Public Spot API
        try {
            const [ethRes, btcRes] = await Promise.allSettled([
                fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot'),
                fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot')
            ]);
            const prices = { ...fallbackPrices };
            if (ethRes.status === 'fulfilled' && ethRes.value.ok) {
                const d = await ethRes.value.json();
                const val = parseFloat(d?.data?.amount);
                if (val > 0) prices.ETH = val;
            }
            if (btcRes.status === 'fulfilled' && btcRes.value.ok) {
                const d = await btcRes.value.json();
                const val = parseFloat(d?.data?.amount);
                if (val > 0) prices.BTC = val;
            }
            cachedLivePrices = prices;
            lastPriceFetchTime = now;
            return prices;
        } catch (_) {}

        // 3. Try LocalStorage cached prices
        try {
            const local = localStorage.getItem('sa_cached_prices');
            if (local) {
                cachedLivePrices = JSON.parse(local);
                return cachedLivePrices;
            }
        } catch (_) {}

        return fallbackPrices;
    }
    window.getLiveCryptoPrices = getLiveCryptoPrices;

    /**
     * Get live spot price for a single currency symbol (default: ETH)
     */
    async function getLivePrice(symbol = 'ETH') {
        const prices = await getLiveCryptoPrices();
        const sym = String(symbol).toUpperCase();
        return prices[sym] || 2450;
    }
    window.getLivePrice = getLivePrice;

    /**
     * Require authentication on protected pages.
     */
    async function requireAuth() {
        if (tg) {
            try {
                tg.expand();
                tg.ready();
            } catch (_) {}
        }

        const tgUser = getTelegramUser();

        if (!tgUser && !isInTelegram()) {
            if (!window.location.pathname.endsWith('open-telegram.html')) {
                window.location.href = 'open-telegram.html';
            }
            return null;
        }

        const result = await signInWithTelegram();
        return result?.session || null;
    }
    window.requireAuth = requireAuth;

    /**
     * Navigation helper that preserves URL hash across pages
     */
    function goTo(url) {
        const hash = window.location.hash || '';
        window.location.href = url + hash;
    }
    window.goTo = goTo;

    /**
     * Auto-preserve hash on all internal links
     */
    document.addEventListener('DOMContentLoaded', () => {
        const hash = window.location.hash || '';
        if (hash) {
            document.querySelectorAll('a[href$=".html"]').forEach(a => {
                const href = a.getAttribute('href');
                if (href && !href.includes('#') && !href.startsWith('http')) {
                    a.setAttribute('href', href + hash);
                }
            });
        }
    });

    /**
     * Sign out
     */
    async function signOut() {
        const tgUser = getTelegramUser();
        if (tgUser) {
            localStorage.removeItem(`sa_session_${tgUser.id}`);
        }
        localStorage.removeItem('sa_tg_user');
        try {
            await _client.auth.signOut();
        } catch (_) {}
        window.location.href = 'index.html';
    }
    window.signOut = signOut;

})();
