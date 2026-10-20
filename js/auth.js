/**
 * SeedAim Cloud — Telegram Mini App Auth Module
 *
 * Strategy:
 *  1. Detect if running inside Telegram WebApp
 *  2. If yes → use Telegram user data (id, first_name, username)
 *     and sign in via Supabase anonymous auth, storing TG profile in DB
 *  3. If opened in regular browser → show a "Open in Telegram" page
 *
 * Depends on:
 *   - Telegram WebApp JS SDK (loaded from telegram CDN)
 *   - supabase-config.js
 *   - Supabase JS SDK
 */

(() => {
    'use strict';

    // ── Init Supabase ─────────────────────────────────────────────────────────
    const { createClient } = supabase;
    const _client = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    window.sb = _client;

    // ── Telegram WebApp detection ─────────────────────────────────────────────
    const tg = window.Telegram?.WebApp;
    window.tg = tg;

    /**
     * Get current Telegram user data (from initDataUnsafe).
     * Returns null if not in Telegram.
     */
    function getTelegramUser() {
        try {
            const user = tg?.initDataUnsafe?.user;
            if (user && user.id) return user;
        } catch (_) {}
        return null;
    }
    window.getTelegramUser = getTelegramUser;

    /**
     * Is the app running inside Telegram?
     */
    function isInTelegram() {
        return !!(tg && tg.initData && tg.initData.length > 0);
    }
    window.isInTelegram = isInTelegram;

    /**
     * Sign in or register the Telegram user in Supabase.
     * Uses anonymous auth + stores TG profile in `profiles` table.
     *
     * Flow:
     *  1. Check if profile for this tg_id already exists
     *  2. If yes → sign in (restore session via localStorage)
     *  3. If no  → create anonymous session + insert profile
     *
     * Returns: { session, profile } or null on error
     */
    async function signInWithTelegram() {
        const tgUser = getTelegramUser();
        if (!tgUser) return null;

        const tgId = String(tgUser.id);
        const storageKey = `sa_session_${tgId}`;

        // Try to restore existing Supabase session from localStorage
        const savedSession = localStorage.getItem(storageKey);
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                const { data: restored } = await _client.auth.setSession({
                    access_token: parsed.access_token,
                    refresh_token: parsed.refresh_token,
                });
                if (restored?.session) {
                    const profile = await _getOrCreateProfile(restored.session.user.id, tgUser);
                    return { session: restored.session, profile };
                }
            } catch (_) {
                localStorage.removeItem(storageKey);
            }
        }

        // No valid session — create a new anonymous one
        const { data: anonData, error: anonError } = await _client.auth.signInAnonymously();
        if (anonError || !anonData?.session) {
            console.error('[SeedAim] Supabase anon sign-in error:', anonError);
            return null;
        }

        // Save session to localStorage keyed by TG user id
        localStorage.setItem(storageKey, JSON.stringify({
            access_token: anonData.session.access_token,
            refresh_token: anonData.session.refresh_token,
        }));

        const profile = await _getOrCreateProfile(anonData.session.user.id, tgUser);
        return { session: anonData.session, profile };
    }
    window.signInWithTelegram = signInWithTelegram;

    /**
     * Internal: get or create profile row in `profiles` table.
     */
    async function _getOrCreateProfile(userId, tgUser) {
        const tgId = String(tgUser.id);

        // Try find by tg_id
        let { data: profile } = await _client
            .from('profiles')
            .select('*')
            .eq('tg_id', tgId)
            .single();

        if (profile) return profile;

        // Create new profile
        const { data: newProfile } = await _client
            .from('profiles')
            .upsert({
                id: userId,
                tg_id: tgId,
                tg_username: tgUser.username || null,
                tg_first_name: tgUser.first_name || null,
                plan: 'trial',
                scans_used: 0,
                scans_limit: 3,
            }, { onConflict: 'id' })
            .select()
            .single();

        return newProfile;
    }

    /**
     * Get profile for the current TG user.
     */
    async function getProfile() {
        const tgUser = getTelegramUser();
        if (!tgUser) return null;
        const tgId = String(tgUser.id);
        const { data } = await _client
            .from('profiles')
            .select('*')
            .eq('tg_id', tgId)
            .single();
        return data;
    }
    window.getProfile = getProfile;

    /**
     * Require Telegram auth. Call on every protected page.
     * If not in Telegram → redirect to open-in-telegram page.
     * If in Telegram but no profile → sign in.
     * Returns { session, profile } or null.
     */
    async function requireAuth() {
        // Expand Telegram WebApp to full screen
        if (tg) {
            tg.expand();
            tg.ready();
        }

        if (!isInTelegram()) {
            // Not in Telegram — redirect to a "please open in Telegram" page
            if (!window.location.pathname.endsWith('open-telegram.html')) {
                window.location.href = 'open-telegram.html';
            }
            return null;
        }

        const result = await signInWithTelegram();
        if (!result) {
            // Auth failed — show error
            document.body.innerHTML = `
                <div style="min-height:100vh;display:grid;place-items:center;background:#050716;color:#fff;font-family:sans-serif;text-align:center;padding:24px">
                    <div>
                        <p style="font-size:32px;margin-bottom:12px">⚠️</p>
                        <h2 style="margin:0 0 10px">Auth error</h2>
                        <p style="color:#7f88ad">Could not connect to SeedAim.<br>Please close and reopen the app.</p>
                    </div>
                </div>`;
            return null;
        }
        return result;
    }
    window.requireAuth = requireAuth;

    /**
     * Sign out (clears local session).
     */
    async function signOut() {
        const tgUser = getTelegramUser();
        if (tgUser) {
            localStorage.removeItem(`sa_session_${tgUser.id}`);
        }
        await _client.auth.signOut();
        window.location.href = 'index.html';
    }
    window.signOut = signOut;

})();
