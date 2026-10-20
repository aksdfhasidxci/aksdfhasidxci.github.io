/**
 * SeedAim Cloud — Supabase Configuration
 *
 * HOW TO SETUP:
 * 1. Go to https://supabase.com and create a free project
 * 2. In your project: Settings → API
 * 3. Copy "Project URL" and "anon public" key
 * 4. Paste them below
 *
 * IMPORTANT: The anon key is safe to use in browser — it's public by design.
 * Row Level Security (RLS) policies protect your data server-side.
 */

const SUPABASE_URL = 'https://civrwmpccapyrzpehqbo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3NkLSArtdAwCZdJK6m_y0Q_DRMZwbBF';

// Export for use in other scripts
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
