/**
 * SeedAim Cloud — Telegram Mini App Auth Module
 * 
 * Works seamlessly inside Telegram WebApp with persistence across all pages.
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
     * Get current Telegram user.
     * Checks:
     *  1. Telegram WebApp SDK (initDataUnsafe.user)
     *  2. URL hash or query params
     *  3. localStorage cache ('sa_tg_user')
     */
    function getTelegramUser() {
        // 1. Check live Telegram WebApp SDK
        try {
            const user = tg?.initDataUnsafe?.user;
            if (user && user.id) {
                localStorage.setItem('sa_tg_user', JSON.stringify(user));
                return user;
            }
        } catch (_) {}

        // 2. Check URL hash for embedded user param
        try {
            const hash = window.location.hash || '';
            if (hash.includes('user=')) {
                const match = hash.match(/user=([^&]+)/);
                if (match && match[1]) {
                    const parsed = JSON.parse(decodeURIComponent(match[1]));
                    if (parsed && parsed.id) {
                        localStorage.setItem('sa_tg_user', JSON.stringify(parsed));
                        return parsed;
                    }
                }
            }
        } catch (_) {}

        // 3. Check localStorage cache
        try {
            const cached = localStorage.getItem('sa_tg_user');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.id) return parsed;
            }
        } catch (_) {}

        return null;
    }
    window.getTelegramUser = getTelegramUser;

    /**
     * Check if currently running inside Telegram context
     */
    function isInTelegram() {
        // If we already know the Telegram user
        if (getTelegramUser()) return true;

        // If Telegram WebApp platform is detected and not unknown
        const platform = tg?.platform;
        if (platform && platform !== 'unknown') return true;

        // If initData is present
        if (tg?.initData && tg.initData.length > 0) return true;

        // If userAgent indicates Telegram
        if (/Telegram/i.test(navigator.userAgent || '')) return true;

        return false;
    }
    window.isInTelegram = isInTelegram;

    /**
     * Internal: get or create profile row in Supabase `profiles` table
     */
    async function _getOrCreateProfile(userId, tgUser) {
        const tgId = String(tgUser.id);
        const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'User';

        // 1. Try find existing by tg_id
        try {
            let { data: profile } = await _client
                .from('profiles')
                .select('*')
                .eq('tg_id', tgId)
                .maybeSingle();

            if (profile) return profile;
        } catch (_) {}

        // 2. Insert new profile
        try {
            const { data: newProfile } = await _client
                .from('profiles')
                .upsert({
                    id: userId,
                    tg_id: tgId,
                    tg_username: tgUser.username || null,
                    tg_first_name: displayName,
                    plan: 'trial',
                    scans_used: 0,
                    scans_limit: 3,
                }, { onConflict: 'id' })
                .select()
                .maybeSingle();

            if (newProfile) return newProfile;
        } catch (err) {
            console.error('[SeedAim] Profile upsert error:', err);
        }

        // Return minimal profile fallback
        return {
            id: userId,
            tg_id: tgId,
            tg_first_name: displayName,
            tg_username: tgUser.username || null,
            plan: 'trial',
            scans_used: 0,
            scans_limit: 3
        };
    }

    /**
     * Sign in via Telegram and Supabase
     */
    async function signInWithTelegram() {
        let tgUser = getTelegramUser();

        // If no user object yet, but in Telegram WebApp, create placeholder user
        if (!tgUser && isInTelegram()) {
            tgUser = {
                id: 'tg_' + Date.now(),
                first_name: 'Telegram User'
            };
            localStorage.setItem('sa_tg_user', JSON.stringify(tgUser));
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
                console.warn('[SeedAim] Anon sign-in failed, trying existing session or fallback:', anonError);
                // Even without Supabase session, create local profile so UI works
                const fallbackProfile = {
                    id: tgId,
                    tg_id: tgId,
                    tg_first_name: tgUser.first_name || 'User',
                    plan: 'trial',
                    scans_used: 0,
                    scans_limit: 3
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

        try {
            const { data } = await _client
                .from('profiles')
                .select('*')
                .eq('tg_id', tgId)
                .maybeSingle();

            if (data) return data;
        } catch (_) {}

        return {
            tg_id: tgId,
            tg_first_name: tgUser.first_name || 'User',
            tg_username: tgUser.username || null,
            plan: 'trial',
            scans_used: 0,
            scans_limit: 3
        };
    }
    window.getProfile = getProfile;

    /**
     * Require authentication on protected pages.
     * Guaranteed never to throw user to open-telegram if they're in Telegram
     * or already have a saved profile.
     */
    async function requireAuth() {
        if (tg) {
            try {
                tg.expand();
                tg.ready();
            } catch (_) {}
        }

        const tgUser = getTelegramUser();

        // If not in Telegram at all and no cached user, redirect to open-telegram
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
