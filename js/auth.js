/**
 * SeedAim Cloud — Auth Module
 * Handles session management, redirects, and user profile loading.
 *
 * Depends on:
 *   - supabase-config.js (loaded before this file)
 *   - Supabase JS SDK (loaded before this file)
 */

(() => {
    'use strict';

    // Initialize Supabase client
    const { createClient } = supabase;
    const _client = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    // Expose globally
    window.sb = _client;

    /**
     * Redirect to login page if user is not authenticated.
     * Call this at the top of protected pages.
     */
    window.requireAuth = async function requireAuth() {
        const { data: { session } } = await _client.auth.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return null;
        }
        return session;
    };

    /**
     * Redirect to dashboard if user IS already authenticated.
     * Call this on the login page so logged-in users skip it.
     */
    window.redirectIfAuthed = async function redirectIfAuthed() {
        const { data: { session } } = await _client.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
        }
    };

    /**
     * Get or create the user's profile from the `profiles` table.
     * @returns {Object|null} profile row
     */
    window.getProfile = async function getProfile() {
        const { data: { session } } = await _client.auth.getSession();
        if (!session) return null;

        const userId = session.user.id;

        // Try to fetch existing profile
        let { data: profile, error } = await _client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        // If profile doesn't exist yet, create it
        if (error && error.code === 'PGRST116') {
            const { data: newProfile } = await _client
                .from('profiles')
                .insert({
                    id: userId,
                    email: session.user.email,
                    plan: 'trial',
                    scans_used: 0,
                    scans_limit: 3,
                })
                .select()
                .single();
            profile = newProfile;
        }

        return profile;
    };

    /**
     * Sign out the current user and redirect to login.
     */
    window.signOut = async function signOut() {
        await _client.auth.signOut();
        window.location.href = 'index.html';
    };

    /**
     * Listen for auth state changes (e.g., email confirmation redirect)
     */
    _client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && window.location.pathname.endsWith('index.html')) {
            window.location.href = 'dashboard.html';
        }
        if (event === 'SIGNED_OUT') {
            if (!window.location.pathname.endsWith('index.html')) {
                window.location.href = 'index.html';
            }
        }
    });

})();
