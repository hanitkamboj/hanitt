/* ============================================
   LyricForge — Dashboard Controller
   ============================================ */

(function () {
    'use strict';

    let supabase;
    let currentVideos = [];
    let currentYTRequests = [];
    let currentVideoId = null;

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
            if (cfg[key] && !localStorage.getItem(lsKey)) {
                localStorage.setItem(lsKey, cfg[key]);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        autoLoadConfig();
        supabase = new LyricForgeSupabase();

        // Load settings into form
        const keys = ['supabaseUrl', 'supabaseKey', 'deepseekKey', 'ytApiKey', 'ytClientId', 'driveFolderId'];
        keys.forEach(key => {
            const el = document.getElementById('d' + key.charAt(0).toUpperCase() + key.slice(1));
            if (el) el.value = localStorage.getItem(key) || '';
        });

        setupEventListeners();
        loadData();
    });

    function setupEventListeners() {
        // Dashboard tabs
        document.querySelectorAll('.dash-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.dash-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const content = document.getElementById('dash' + tab.dataset.dtab.charAt(0).toUpperCase() + tab.dataset.dtab.slice(1));
                if (content) content.classList.add('active');
            });
        });

        // Search
        document.getElementById('videoSearch')?.addEventListener('input', filterVideos);
        document.getElementById('videoFilter')?.addEventListener('change', filterVideos);

        // Save settings
        document.getElementById('dSaveSettings')?.addEventListener('click', saveSettings);

        // Delete video
        document.getElementById('deleteVideoBtn')?.addEventListener('click', deleteVideo);

        // Settings modal
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.dash-content').forEach(c => c.classList.remove('active'));
            const settingsTab = document.querySelector('[data-dtab="settings"]');
            if (settingsTab) {
                settingsTab.classList.add('active');
                document.getElementById('dashSettings')?.classList.add('active');
            }
        });

        // Modals
        document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
            }
        });
    }

    async function loadData() {
        await Promise.all([loadVideos(), loadYTRequests()]);
    }

    async function loadVideos() {
        if (!supabase.isConnected()) {
            document.getElementById('videosGrid').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>Supabase not connected</h3>
                    <p>Configure your Supabase credentials in Settings to manage videos.</p>
                    <button class="btn btn-primary" onclick="document.querySelector('[data-dtab=\\'settings\\']')?.click()">
                        <i class="fas fa-cog"></i> Configure
                    </button>
                </div>
            `;
            return;
        }

        const videos = await supabase.getVideos();
        currentVideos = videos;
        renderVideos(videos);
        updateStats(videos);
    }

    async function loadYTRequests() {
        if (!supabase.isConnected()) return;

        const requests = await supabase.getYouTubeRequests();
        currentYTRequests = requests;
        renderYTRequests(requests);
    }

    function renderVideos(videos) {
        const grid = document.getElementById('videosGrid');
        if (!videos || videos.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video"></i>
                    <h3>No videos yet</h3>
                    <p>Create your first lyric video to see it here.</p>
                    <a href="index.html" class="btn btn-primary"><i class="fas fa-plus"></i> Create Video</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = videos.map(v => `
            <div class="video-card" data-id="${v.id}">
                <div class="video-card-thumb">
                    <i class="fas fa-music"></i>
                </div>
                <div class="video-card-info">
                    <div class="video-card-title">${escapeHtml(v.artist_name || 'Unknown')} — ${escapeHtml(v.song_name || 'Unknown')}</div>
                    <div class="video-card-meta">
                        <span>${v.version || ''}</span>
                        <span>${v.duration ? formatDuration(v.duration) : ''}</span>
                        <span>${v.lyrics_count || 0} lines</span>
                    </div>
                    <div class="video-card-status ${v.status || 'draft'}">
                        <i class="fas fa-circle"></i> ${v.status || 'draft'}
                    </div>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', () => showVideoDetail(card.dataset.id));
        });
    }

    function renderYTRequests(requests) {
        const list = document.getElementById('ytRequestsList');
        if (!requests || requests.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fab fa-youtube"></i>
                    <h3>No YouTube uploads yet</h3>
                    <p>Upload a video to YouTube to track it here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = requests.map(r => `
            <div class="yt-request-item">
                <div class="yt-request-info">
                    <h4>${escapeHtml(r.title || 'Untitled')}</h4>
                    <p>${r.created_at ? new Date(r.created_at).toLocaleDateString() : ''} • ${(r.tags || []).slice(0, 3).join(', ')}</p>
                </div>
                <span class="yt-request-status ${r.status || 'pending'}">${r.status || 'pending'}</span>
            </div>
        `).join('');
    }

    function updateStats(videos) {
        document.getElementById('statVideos').textContent = videos.length;
        const totalDur = videos.reduce((sum, v) => sum + (v.duration || 0), 0);
        document.getElementById('statDuration').textContent = Math.round(totalDur / 60) + 'm';
        document.getElementById('statYouTube').textContent = currentYTRequests.length;
    }

    function filterVideos() {
        const search = (document.getElementById('videoSearch')?.value || '').toLowerCase();
        const filter = document.getElementById('videoFilter')?.value || 'all';

        let filtered = currentVideos;

        if (filter !== 'all') {
            filtered = filtered.filter(v => v.status === filter);
        }

        if (search) {
            filtered = filtered.filter(v =>
                (v.artist_name || '').toLowerCase().includes(search) ||
                (v.song_name || '').toLowerCase().includes(search)
            );
        }

        renderVideos(filtered);
    }

    async function showVideoDetail(id) {
        currentVideoId = id;
        const body = document.getElementById('videoDetailBody');

        if (supabase.isConnected()) {
            const video = await supabase.getVideo(id);
            if (video) {
                body.innerHTML = `
                    <div class="video-detail-item">
                        <label>Artist</label>
                        <div class="value">${escapeHtml(video.artist_name || 'N/A')}</div>
                    </div>
                    <div class="video-detail-item">
                        <label>Song</label>
                        <div class="value">${escapeHtml(video.song_name || 'N/A')}</div>
                    </div>
                    <div class="video-detail-item">
                        <label>Version</label>
                        <div class="value">${escapeHtml(video.version || 'N/A')}</div>
                    </div>
                    <div class="video-detail-item">
                        <label>Duration</label>
                        <div class="value">${video.duration ? formatDuration(video.duration) : 'N/A'}</div>
                    </div>
                    <div class="video-detail-item">
                        <label>Lyrics</label>
                        <div class="value">${video.lyrics_count || 0} lines</div>
                    </div>
                    <div class="video-detail-item">
                        <label>Status</label>
                        <div class="value">${video.status || 'draft'}</div>
                    </div>
                    <div class="video-detail-item">
                        <label>Created</label>
                        <div class="value">${video.created_at ? new Date(video.created_at).toLocaleString() : 'N/A'}</div>
                    </div>
                `;
            }
        } else {
            body.innerHTML = '<div class="video-detail-loading">Supabase not connected. Connect in Settings.</div>';
        }

        document.getElementById('videoDetailModal').classList.add('show');
    }

    async function deleteVideo() {
        if (!currentVideoId || !supabase.isConnected()) return;

        if (!confirm('Are you sure you want to delete this video?')) return;

        const success = await supabase.deleteVideo(currentVideoId);
        if (success) {
            document.getElementById('videoDetailModal').classList.remove('show');
            loadVideos();
        }
    }

    function saveSettings() {
        const keys = ['supabaseUrl', 'supabaseKey', 'deepseekKey', 'ytApiKey', 'ytClientId', 'driveFolderId'];
        keys.forEach(key => {
            const el = document.getElementById('d' + key.charAt(0).toUpperCase() + key.slice(1));
            if (el) {
                localStorage.setItem(key, el.value);
            }
        });

        supabase = new LyricForgeSupabase();
        loadData();
        alert('Settings saved!');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

})();
