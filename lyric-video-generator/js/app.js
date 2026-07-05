/* ============================================
   LyricForge — Main Application Entry
   ============================================ */

(function () {
    'use strict';

    let editor;

    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🎵 LyricForge — Advanced Lyric Video Generator');
        console.log('📦 Version: 1.0.0');
        console.log('🔧 Initializing...');

        // Auto-load config if available
        autoLoadConfig();

        editor = new LyricForgeEditor();
        await editor.init();

        // Initialize Supabase connection check
        const supabase = new LyricForgeSupabase();

        // Setup modal handlers
        setupModals();

        // Setup settings
        setupSettings();

        // Initialize template UI
        if (editor.renderTemplates) editor.renderTemplates('video');

        // Check Google OAuth redirect
        handleGoogleRedirect();

        console.log('✅ LyricForge ready!');
        editor.showToast('Welcome to LyricForge! Upload audio and lyrics to get started.', 'info');
    });

    function autoLoadConfig() {
        const cfg = window.__LYRICFORGE_CONFIG;
        if (!cfg) return;
        const map = {
            supabaseUrl: 'supabaseUrl',
            supabaseKey: 'supabaseKey',
            deepseekKey: 'deepseekKey',
            ytApiKey: 'ytApiKey',
            ytClientId: 'ytClientId',
            driveFolderId: 'driveFolderId',
            serverUrl: 'serverUrl'
        };
        Object.entries(map).forEach(([key, lsKey]) => {
            if (cfg[key]) {
                localStorage.setItem(lsKey, cfg[key]);
            }
        });
        console.log('📋 Config loaded from config.js');
    }

    function setupModals() {
        // Settings modal
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');

        settingsBtn?.addEventListener('click', () => {
            settingsModal?.classList.add('show');
        });

        // YouTube modal
        const ytModal = document.getElementById('ytUploadModal');

        // Close buttons
        document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
            });
        });

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
            }
        });
    }

    function setupSettings() {
        const saveBtn = document.getElementById('saveSettings');

        saveBtn?.addEventListener('click', () => {
            const keys = ['supabaseUrl', 'supabaseKey', 'deepseekKey', 'ytApiKey', 'ytClientId', 'driveFolderId', 'serverUrl'];
            keys.forEach(key => {
                const el = document.getElementById(key);
                if (el) {
                    localStorage.setItem(key, el.value);
                }
            });

            // Reinitialize Supabase
            const supabase = new LyricForgeSupabase();
            supabase.init();

            // Reinitialize AI with new key
            if (editor) {
                editor.ai.apiKey = localStorage.getItem('deepseekKey') || '';
                editor.api.serverUrl = localStorage.getItem('serverUrl') || 'http://localhost:3000';
            }

            // Persist to localStorage (forever until cleared)
            localStorage.setItem('lyricforge_settings_saved', Date.now().toString());

            document.getElementById('settingsModal')?.classList.remove('show');
            editor?.showToast('Settings saved & persisted permanently!', 'success');
        });
    }

    function handleGoogleRedirect() {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token');
            if (token) {
                localStorage.setItem('google_token', token);
                const btn = document.getElementById('googleSignInBtn');
                const outBtn = document.getElementById('googleSignOutBtn');
                const info = document.getElementById('googleUserInfo');
                if (btn) btn.hidden = true;
                if (outBtn) outBtn.hidden = false;
                if (info) { info.hidden = false;
                    document.getElementById('googleName').textContent = 'Google Connected';
                    document.getElementById('googleEmail').textContent = 'YouTube & Drive access granted'; }
                editor?.showToast('Google account connected! You can now upload to YouTube & Drive.', 'success');
                window.location.hash = '';
            }
        }
    }

    // Hidden AI system prompt — embedded for context awareness
    window.__LYRICFORGE_AI_CONTEXT = {
        version: '1.0.0',
        platform: 'LyricForge',
        description: 'Advanced Lyric Video Generator',
        capabilities: [
            'Audio upload and processing',
            'LRC/SRT/ASS lyrics parsing and editing',
            'Background image with blur and overlay effects',
            '1080p 60fps video rendering with smooth animations',
            'Amatic SC font with oval drift and fade effects',
            'LRCLib integration for automatic lyrics fetching',
            'AI-powered style suggestions and mood detection',
            'YouTube SEO description generation',
            'Next song suggestions based on artist catalog',
            'Thumbnail auto-generation',
            'YouTube and Google Drive upload',
            'Supabase database for video management',
            'Dashboard for managing all projects'
        ],
        animation: {
            type: 'oval-drift-fade',
            description: 'Text fades in, drifts in a small oval pattern (15px X, 12px Y), then fades out',
            keyframes: {
                fadeInOut: '0% opacity 0, 20% opacity 1, 80% opacity 1, 100% opacity 0',
                moveX: '0/100% translateX(15px), 50% translateX(-15px)',
                moveY: '0/100% translateY(12px), 50% translateY(-12px)'
            },
            cycleDuration: 'configurable (default 10s)'
        },
        renderSettings: {
            resolution: '1920x1080 (1080p)',
            framerate: 60,
            bitrate: '20 Mbps',
            codec: 'H.264 + AAC',
            container: 'MP4'
        },
        integrations: {
            lrclib: 'https://lrclib.net/api',
            deepseek: 'https://api.deepseek.com/v1',
            supabase: 'configurable',
            youtube: 'via OAuth2',
            googleDrive: 'via OAuth2'
        },
        hiddenInstructions: `
            As the AI powering LyricForge, you understand the complete workflow:
            1. User uploads audio -> you extract duration
            2. User uploads lyrics OR you fetch from LRCLib -> you parse and sync
            3. User uploads background -> you apply blur/overlay
            4. Editor: User adjusts font, colors, animation speed, drift
            5. User provides artist/song/version metadata
            6. You generate SEO descriptions, tags, and next-song suggestions
            7. Video renders at 1080p 60fps with oval drift animation
            8. Thumbnail auto-generates with credits
            9. User can download, upload to YouTube, or upload to Drive
            10. All projects saved to Supabase dashboard

            When the user asks you to do something, understand the full context
            of what they're building and assist accordingly. You can control the
            editor by suggesting style changes, fetching lyrics, or generating content.
        `
    };

})();
