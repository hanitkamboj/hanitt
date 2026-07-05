/* ============================================
   LyricForge — Editor Controller
   ============================================ */

class LyricForgeEditor {
    constructor() {
        this.renderer = null;
        this.api = new LyricForgeAPI();
        this.ai = new LyricForgeAI();
        this.lyrics = [];
        this.audioFile = null;
        this.bgImage = null;
        this.audioElement = null;
        this.audioDuration = 0;
        this.isPlaying = false;
        this.projectConfig = {};
        this.renderedBlob = null;
        this.thumbnailBlob = null;
    }

    async init() {
        this.renderer = new VideoRenderer();
        const canvas = document.getElementById('previewCanvas');
        await this.renderer.init(canvas, this.getStyleFromUI());
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Upload handlers
        this.setupUpload('audioInput', 'audioDrop', 'audioPreview', 'audioCard', (file) => {
            this.handleAudioUpload(file);
        });
        this.setupUpload('lyricsInput', 'lyricsDrop', 'lyricsPreview', 'lyricsCard', (file) => {
            this.handleLyricsUpload(file);
        });
        this.setupUpload('bgInput', 'bgDrop', 'bgPreview', 'bgCard', (file) => {
            this.handleBgUpload(file);
        });

        // Remove buttons
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = btn.dataset.target;
                if (target === 'audio') this.removeAudio();
                if (target === 'lyrics') this.removeLyrics();
                if (target === 'bg') this.removeBg();
            });
        });

        // Navigation
        document.getElementById('toStep2').addEventListener('click', () => this.goToStep(2));
        document.getElementById('toStep1').addEventListener('click', () => this.goToStep(1));

        // Play controls
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('seekBar').addEventListener('input', (e) => this.seek(e));

        // Fetch lyrics
        document.getElementById('fetchLyricsBtn').addEventListener('click', () => this.fetchLyrics());
        document.getElementById('songQuery').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.fetchLyrics();
        });

        // Style controls
        this.setupStyleControls();

        // AI
        document.getElementById('aiSuggestBtn').addEventListener('click', () => this.generateAISuggestions());
        document.getElementById('nextSongBtn').addEventListener('click', () => this.suggestNextSong());
        document.getElementById('generateDescBtn').addEventListener('click', () => this.generateDescription());

        // Render
        document.getElementById('renderBtn').addEventListener('click', () => this.startRender());

        // Export
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadVideo());
        document.getElementById('downloadThumbBtn').addEventListener('click', () => this.downloadThumbnail());
        document.getElementById('uploadYTBtn').addEventListener('click', () => this.showYTModal());
        document.getElementById('uploadDriveBtn').addEventListener('click', () => this.uploadToDrive());

        // Confirm YT Upload
        document.getElementById('confirmYtUpload').addEventListener('click', () => this.confirmYTUpload());

        // Editor tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab));
        });

        // Preview overlay click
        document.querySelector('.preview-container').addEventListener('click', () => this.togglePlay());

        // Restore settings
        this.loadSettings();
    }

    setupUpload(inputId, dropId, previewId, cardId, handler) {
        const input = document.getElementById(inputId);
        const drop = document.getElementById(dropId);
        const preview = document.getElementById(previewId);
        const card = document.getElementById(cardId);

        drop.addEventListener('click', () => input.click());
        drop.addEventListener('dragover', (e) => {
            e.preventDefault();
            drop.classList.add('dragover');
        });
        drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handler(file);
        });
        input.addEventListener('change', () => {
            if (input.files[0]) handler(input.files[0]);
        });
    }

    handleAudioUpload(file) {
        if (!file.type.startsWith('audio/')) {
            this.showToast('Please upload a valid audio file', 'error');
            return;
        }
        this.audioFile = file;
        this.showFilePreview('audioPreview', file.name, '');
        this.api.getAudioDuration(file).then(dur => {
            this.audioDuration = dur;
            if (this.audioElement) {
                this.audioElement.src = URL.createObjectURL(file);
                this.audioElement.load();
            }
            document.getElementById('toStep2').disabled = !this.hasMinimumInputs();
            this.showToast(`Audio loaded: ${file.name} (${this.api.formatDuration(dur)})`, 'success');
        });
    }

    handleLyricsUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const parsed = LyricsParser.parse(content);
            if (!parsed || parsed.length === 0) {
                this.showToast('Could not parse lyrics file. Check the format.', 'error');
                return;
            }
            this.lyrics = parsed;
            this.showFilePreview('lyricsPreview', file.name, '');
            this.renderer.setLyrics(this.lyrics);
            this.updateLyricList();
            document.getElementById('toStep2').disabled = !this.hasMinimumInputs();
            this.showToast(`Loaded ${parsed.length} lyric lines`, 'success');
        };
        reader.readAsText(file);
    }

    handleBgUpload(file) {
        if (!file.type.startsWith('image/')) {
            this.showToast('Please upload a valid image file', 'error');
            return;
        }
        const img = new Image();
        img.onload = () => {
            this.bgImage = img;
            this.showFilePreview('bgPreview', file.name, img);
            this.renderer.setBackground(img);
            document.getElementById('toStep2').disabled = !this.hasMinimumInputs();
            this.showToast('Background image loaded', 'success');
        };
        img.src = URL.createObjectURL(file);
    }

    showFilePreview(previewId, fileName, extra) {
        const preview = document.getElementById(previewId);
        preview.hidden = false;
        preview.classList.add('show');
        const nameEl = preview.querySelector('.file-name');
        if (nameEl) nameEl.textContent = fileName;

        if (extra && previewId === 'bgPreview') {
            const img = preview.querySelector('img');
            if (img) {
                img.src = extra.src || extra;
                img.style.display = 'block';
            }
        }

        const drop = preview.previousElementSibling;
        if (drop && drop.classList.contains('file-drop')) {
            drop.style.display = 'none';
        }
    }

    removeAudio() {
        this.audioFile = null;
        this.audioDuration = 0;
        this.hidePreview('audioPreview');
        document.getElementById('toStep2').disabled = !this.hasMinimumInputs();
    }

    removeLyrics() {
        this.lyrics = [];
        this.hidePreview('lyricsPreview');
        this.renderer.setLyrics([]);
        this.updateLyricList();
        document.getElementById('toStep2').disabled = !this.hasMinimumInputs();
    }

    removeBg() {
        this.bgImage = null;
        this.hidePreview('bgPreview');
        this.renderer.setBackground(null);
        document.getElementById('toStep2').disabled = !this.hasMinimumInputs();
    }

    hidePreview(previewId) {
        const preview = document.getElementById(previewId);
        preview.hidden = true;
        preview.classList.remove('show');
        const drop = preview.previousElementSibling;
        if (drop && drop.classList.contains('file-drop')) {
            drop.style.display = 'block';
        }
    }

    hasMinimumInputs() {
        return this.audioFile !== null && this.lyrics.length > 0;
    }

    getStyleFromUI() {
        return {
            fontFamily: document.getElementById('fontFamily')?.value || 'Amatic SC',
            fontSize: parseFloat(document.getElementById('fontSize')?.value || '8'),
            textColor: document.getElementById('textColor')?.value || '#ffffff',
            shadowIntensity: parseInt(document.getElementById('shadowIntensity')?.value || '15'),
            animSpeed: parseFloat(document.getElementById('animSpeed')?.value || '10'),
            driftAmount: parseInt(document.getElementById('driftAmount')?.value || '15'),
            overlayColor: document.getElementById('overlayColor')?.value || '#6c11c9',
            overlayOpacity: parseFloat(document.getElementById('overlayOpacity')?.value || '0.3'),
            bgBlur: parseInt(document.getElementById('bgBlur')?.value || '5'),
            artistName: document.getElementById('artistName')?.value || '',
            songName: document.getElementById('songName')?.value || '',
            versionName: document.getElementById('versionName')?.value || ''
        };
    }

    setupStyleControls() {
        const rangeIds = ['fontSize', 'shadowIntensity', 'animSpeed', 'driftAmount', 'overlayOpacity', 'bgBlur'];
        rangeIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                const valEl = document.getElementById(id + 'Val');
                if (valEl) {
                    valEl.textContent = el.value + (id === 'overlayOpacity' ? '' : (id === 'fontSize' ? 'vw' : id === 'animSpeed' ? 's' : 'px'));
                }
                this.updatePreview();
            });
        });

        document.getElementById('fontFamily')?.addEventListener('change', () => this.updatePreview());
        document.getElementById('textColor')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('overlayColor')?.addEventListener('input', () => this.updatePreview());

        document.getElementById('artistName')?.addEventListener('input', () => this.updateMetadata());
        document.getElementById('songName')?.addEventListener('input', () => this.updateMetadata());
        document.getElementById('versionName')?.addEventListener('input', () => this.updateMetadata());
    }

    updatePreview() {
        const config = this.getStyleFromUI();
        this.renderer.updateConfig(config);
        if (!this.isPlaying) {
            const time = this.audioElement ? this.audioElement.currentTime : 0;
            this.renderer.drawFrame(time);
        }
    }

    updateMetadata() {
        this.projectConfig.artistName = document.getElementById('artistName')?.value || '';
        this.projectConfig.songName = document.getElementById('songName')?.value || '';
        this.projectConfig.versionName = document.getElementById('versionName')?.value || '';
    }

    updateLyricList() {
        const list = document.getElementById('lyricList');
        if (!list) return;
        if (this.lyrics.length === 0) {
            list.innerHTML = '<div class="lyric-list-empty">No lyrics loaded.</div>';
            return;
        }
        list.innerHTML = this.lyrics.map((l, i) =>
            `<div class="lyric-item" data-index="${i}">
                <span class="lyric-time">${LyricsParser.formatTime(l.time)}</span>
                <span class="lyric-text">${this.escapeHtml(l.text)}</span>
            </div>`
        ).join('');
    }

    switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabContent = document.getElementById('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
        if (tabContent) tabContent.classList.add('active');
    }

    /* ---- Navigation ---- */
    goToStep(step) {
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

        if (step === 2) {
            document.getElementById('stepUpload').classList.remove('active');
            document.getElementById('stepEditor').classList.add('active');

            if (!this.audioElement) {
                this.audioElement = new Audio();
                if (this.audioFile) {
                    this.audioElement.src = URL.createObjectURL(this.audioFile);
                }
            }

            const renderCanvas = document.getElementById('renderCanvas');
            const canvas = document.getElementById('previewCanvas');
            this.renderer.canvas = canvas;
            this.renderer.ctx = canvas.getContext('2d', { alpha: false });
            this.updatePreview();

            if (!this.isPlaying) {
                this.renderer.drawFrame(0);
            }

            this.updateLyricList();
        } else if (step === 3) {
            document.getElementById('stepEditor').classList.remove('active');
            document.getElementById('stepRender').classList.add('active');
        } else {
            document.getElementById('stepUpload').classList.add('active');
        }
    }

    /* ---- Playback ---- */
    togglePlay() {
        if (!this.audioElement) return;
        if (this.isPlaying) {
            this.audioElement.pause();
            this.renderer.stopPreview();
            this.isPlaying = false;
            document.querySelector('#playBtn i').className = 'fas fa-play';
        } else {
            this.audioElement.play();
            this.renderer.startPreview(this.audioElement);
            this.isPlaying = true;
            document.querySelector('#playBtn i').className = 'fas fa-pause';
        }
    }

    seek(e) {
        if (!this.audioElement) return;
        const pct = parseFloat(e.target.value) / 100;
        const time = pct * (this.audioDuration || 30);
        this.audioElement.currentTime = time;
        if (!this.isPlaying) {
            this.renderer.drawFrame(time);
        }
    }

    /* ---- Fetch Lyrics from LRCLib ---- */
    async fetchLyrics() {
        const query = document.getElementById('songQuery').value.trim();
        if (!query) {
            this.showToast('Enter a song name to search', 'warning');
            return;
        }

        const resultsEl = document.getElementById('fetchResults');
        resultsEl.innerHTML = '<div class="fetch-result-item">Searching...</div>';

        const results = await this.api.searchLyrics(query);

        if (!results || results.length === 0) {
            resultsEl.innerHTML = '<div class="fetch-result-item">No results found. Try a different search.</div>';
            return;
        }

        resultsEl.innerHTML = results.slice(0, 10).map(r =>
            `<div class="fetch-result-item" data-id="${r.id || ''}" data-artist="${r.artistName || ''}" data-song="${r.trackName || ''}">
                ${r.artistName || 'Unknown'} — ${r.trackName || 'Unknown'}
            </div>`
        ).join('');

        resultsEl.querySelectorAll('.fetch-result-item').forEach(el => {
            el.addEventListener('click', async () => {
                const id = el.dataset.id;
                const artist = el.dataset.artist;
                const songName = el.dataset.song;

                if (id) {
                    resultsEl.innerHTML = '<div class="fetch-result-item">Loading lyrics...</div>';
                    const data = await this.api.getLyrics(id);
                    if (data && data.syncedLyrics) {
                        this.lyrics = LyricsParser.parse(data.syncedLyrics.startsWith('[') ? data.syncedLyrics : `[00:00.00]${data.syncedLyrics}`);
                        if (!this.lyrics || this.lyrics.length === 0) {
                            this.lyrics = LyricsParser.parse(`[00:00.00]${data.syncedLyrics}`);
                        }
                    } else if (data && data.plainLyrics) {
                        const words = data.plainLyrics.split('\n').filter(l => l.trim());
                        this.lyrics = words.map((text, i) => ({
                            time: i * 4,
                            text: text.trim(),
                            index: i
                        }));
                    }

                    if (this.lyrics && this.lyrics.length > 0) {
                        this.renderer.setLyrics(this.lyrics);
                        this.updateLyricList();
                        if (artist) document.getElementById('artistName').value = artist;
                        if (songName) document.getElementById('songName').value = songName;
                        this.updateMetadata();
                        this.goToStep(2);
                        this.showToast(`Fetched ${this.lyrics.length} lyric lines from LRCLib`, 'success');
                        resultsEl.innerHTML = '';
                    } else {
                        resultsEl.innerHTML = '<div class="fetch-result-item">No synced lyrics available.</div>';
                    }
                }
            });
        });
    }

    /* ---- AI Features ---- */
    async generateAISuggestions() {
        const artist = document.getElementById('artistName').value || 'Unknown Artist';
        const song = document.getElementById('songName').value || 'Unknown Song';
        const lyricsText = this.lyrics.map(l => l.text).join('\n');

        const btn = document.getElementById('aiSuggestBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        const result = await this.ai.suggestStyle(lyricsText, artist, song);

        if (result) {
            if (result.mood) {
                this.showToast(`Detected mood: ${result.mood}`, 'success');
            }
            if (result.recommendedFontSize) {
                document.getElementById('fontSize').value = result.recommendedFontSize;
                document.getElementById('fontSizeVal').textContent = result.recommendedFontSize + 'vw';
            }
            if (result.recommendedDrift) {
                document.getElementById('driftAmount').value = result.recommendedDrift;
                document.getElementById('driftVal').textContent = result.recommendedDrift + 'px';
            }
            if (result.colorSuggestion) {
                document.getElementById('overlayColor').value = result.colorSuggestion;
            }

            const list = document.getElementById('suggestionList');
            list.innerHTML = `
                <div class="suggestion-tag">🎵 Mood: ${result.mood || 'N/A'}</div>
                <div class="suggestion-tag">📏 Size: ${result.recommendedFontSize || 8}vw</div>
                <div class="suggestion-tag">🎨 Color: ${result.colorSuggestion || 'Default'}</div>
                ${result.reason ? `<div class="suggestion-tag">💡 ${result.reason}</div>` : ''}
            `;

            this.updatePreview();
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-magic"></i> Generate Suggestions';
    }

    async suggestNextSong() {
        const artist = document.getElementById('artistName').value;
        const song = document.getElementById('songName').value;

        if (!artist || !song) {
            this.showToast('Enter artist and song name first', 'warning');
            return;
        }

        const btn = document.getElementById('nextSongBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';

        const result = await this.ai.suggestNextSong(artist, song);
        const el = document.getElementById('nextSongResult');

        if (result && result.suggestions) {
            el.innerHTML = result.suggestions.map(s =>
                `<div class="suggestion-tag" style="display:block;margin-bottom:4px;">
                    <strong>${s.songName}</strong>: ${s.reason} <em>(${s.estimatedDifficulty})</em>
                </div>`
            ).join('');
        } else {
            el.innerHTML = '<div>No suggestions available. Connect DeepSeek API for AI suggestions.</div>';
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-forward"></i> Suggest Next Song';
    }

    async generateDescription() {
        const artist = document.getElementById('artistName').value;
        const song = document.getElementById('songName').value;
        const version = document.getElementById('versionName').value;
        const lyricsText = this.lyrics.map(l => l.text).join('\n');

        if (!artist || !song) {
            this.showToast('Enter artist and song name first', 'warning');
            return;
        }

        document.getElementById('generateDescBtn').disabled = true;
        document.getElementById('generateDescBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        const result = await this.ai.generateDescription(artist, song, version, lyricsText);

        if (result) {
            document.getElementById('ytTitle').value = result.title || `${artist} - ${song} (Official Lyric Video)`;
            document.getElementById('ytDescription').value = result.description || '';
            document.getElementById('ytTags').value = (result.tags || []).join(', ');
            this.showToast('YouTube description generated!', 'success');
        }

        document.getElementById('generateDescBtn').disabled = false;
        document.getElementById('generateDescBtn').innerHTML = '<i class="fas fa-magic"></i> Generate with AI';
    }

    /* ---- Rendering ---- */
    async startRender() {
        if (this.renderer.isRendering) {
            this.showToast('Already rendering!', 'warning');
            return;
        }

        const config = this.getStyleFromUI();
        this.renderer.updateConfig(config);

        if (this.audioFile) {
            this.renderer.setAudio(this.audioFile);
        }
        if (this.audioDuration) {
            this.renderer.setDuration(this.audioDuration);
        }

        this.goToStep(3);

        const canvas = document.getElementById('renderCanvas');
        this.renderer.canvas = canvas;
        this.renderer.ctx = canvas.getContext('2d', { alpha: false });

        document.getElementById('renderActions').hidden = true;
        document.getElementById('renderStatus').textContent = 'Rendering...';
        document.getElementById('renderProgress').style.width = '0%';

        try {
            const blob = await this.renderer.render({
                fps: 60,
                width: 1920,
                height: 1080,
                bitrate: 20000000,
                onProgress: (p) => {
                    document.getElementById('renderProgress').style.width = p.percent + '%';
                    document.getElementById('renderPercent').textContent = Math.round(p.percent) + '%';
                    document.getElementById('renderFrame').textContent = `Frame: ${p.frame}`;
                    document.getElementById('renderTime').textContent = `Time: ${this.api.formatDuration(p.time)}`;
                    document.getElementById('renderStatus').textContent =
                        p.percent < 100 ? 'Rendering...' : 'Finalizing...';
                }
            });

            this.renderedBlob = blob;
            document.getElementById('renderStatus').textContent = '✅ Render complete!';
            document.getElementById('renderProgress').style.width = '100%';
            document.getElementById('renderActions').hidden = false;

            // Generate thumbnail
            this.thumbnailBlob = await this.renderer.generateThumbnail(2);

            // Save to Supabase
            const supabase = new LyricForgeSupabase();
            await supabase.saveVideo({
                artistName: config.artistName,
                songName: config.songName,
                versionName: config.versionName,
                config,
                lyricsCount: this.lyrics.length,
                duration: this.audioDuration
            });

            this.showToast(`Video rendered! ${(blob.size / 1024 / 1024).toFixed(1)} MB`, 'success');

        } catch (e) {
            console.error('Render error:', e);
            document.getElementById('renderStatus').textContent = '❌ Render failed';
            this.showToast('Render failed: ' + e.message, 'error');
        }
    }

    /* ---- Export ---- */
    downloadVideo() {
        if (!this.renderedBlob) {
            this.showToast('No rendered video available', 'warning');
            return;
        }
        const config = this.getStyleFromUI();
        const name = `${config.artistName || 'unknown'}-${config.songName || 'unknown'}-lyric-video`.replace(/\s+/g, '_');
        const ext = this.renderedBlob.type.includes('mp4') ? 'mp4' : 'webm';
        this.api.downloadBlob(this.renderedBlob, `${name}.${ext}`);
        this.showToast('Downloading video...', 'success');
    }

    async downloadThumbnail() {
        if (!this.thumbnailBlob) {
            this.thumbnailBlob = await this.renderer.generateThumbnail(2);
        }
        const config = this.getStyleFromUI();
        const name = `${config.artistName || 'unknown'}-${config.songName || 'unknown'}-thumbnail`.replace(/\s+/g, '_');
        this.api.downloadBlob(this.thumbnailBlob, `${name}.jpg`);
        this.showToast('Downloading thumbnail...', 'success');
    }

    showYTModal() {
        if (!this.renderedBlob) {
            this.showToast('Render a video first', 'warning');
            return;
        }

        const config = this.getStyleFromUI();
        document.getElementById('ytTitle').value = `${config.artistName || 'Artist'} - ${config.songName || 'Song'} (Official Lyric Video)`;

        const lyricsText = this.lyrics.map(l => l.text).join('\n');
        document.getElementById('ytDescription').value =
            `${config.artistName || 'Artist'} - ${config.songName || 'Song'} (Official Lyric Video)\n\n` +
            `🎵 Listen to more from ${config.artistName || 'the artist'}:\n\n` +
            `📌 Lyrics:\n${lyricsText}\n\n` +
            `---\n\n🔔 Subscribe for more lyric videos!\n` +
            `© ${new Date().getFullYear()} ${config.artistName || 'Artist'}. All rights reserved.`;

        document.getElementById('ytTags').value =
            `${config.artistName || ''}, ${config.songName || ''}, lyric video, official lyric video, music, lyrics`
                .split(',').filter(t => t.trim()).join(', ');

        document.getElementById('ytUploadModal').classList.add('show');
    }

    async confirmYTUpload() {
        const title = document.getElementById('ytTitle').value;
        const description = document.getElementById('ytDescription').value;
        const tags = document.getElementById('ytTags').value.split(',').map(t => t.trim());
        const category = document.getElementById('ytCategory').value;
        const visibility = document.getElementById('ytVisibility').value;

        if (!title) {
            this.showToast('Enter a video title', 'warning');
            return;
        }

        document.getElementById('confirmYtUpload').disabled = true;
        document.getElementById('confirmYtUpload').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

        try {
            const result = await this.api.uploadToYouTube(this.renderedBlob, {
                title,
                description,
                tags,
                category,
                visibility
            });

            if (result) {
                this.showToast('Uploaded to YouTube successfully!', 'success');
                document.getElementById('ytUploadModal').classList.remove('show');

                const supabase = new LyricForgeSupabase();
                await supabase.createYouTubeRequest({
                    title,
                    description,
                    tags,
                    visibility
                });
            } else {
                this.showToast('YouTube upload requires backend configuration. See Settings.', 'warning');
            }
        } catch (e) {
            this.showToast('YouTube upload failed: ' + e.message, 'error');
        }

        document.getElementById('confirmYtUpload').disabled = false;
        document.getElementById('confirmYtUpload').innerHTML = '<i class="fab fa-youtube"></i> Upload';
    }

    async uploadToDrive() {
        if (!this.renderedBlob) {
            this.showToast('Render a video first', 'warning');
            return;
        }

        const config = this.getStyleFromUI();
        const name = `${config.artistName || 'unknown'}-${config.songName || 'unknown'}-lyric-video`.replace(/\s+/g, '_');
        const ext = this.renderedBlob.type.includes('mp4') ? 'mp4' : 'webm';
        const folderId = localStorage.getItem('driveFolderId') || '';

        try {
            const result = await this.api.uploadToDrive(this.renderedBlob, `${name}.${ext}`, folderId);
            if (result) {
                this.showToast('Uploaded to Google Drive!', 'success');
            } else {
                this.showToast('Drive upload requires backend configuration. See Settings.', 'warning');
            }
        } catch (e) {
            this.showToast('Drive upload failed: ' + e.message, 'error');
        }
    }

    /* ---- Settings ---- */
    loadSettings() {
        const keys = ['supabaseUrl', 'supabaseKey', 'deepseekKey', 'ytApiKey', 'ytClientId', 'driveFolderId', 'serverUrl'];
        keys.forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = localStorage.getItem(key) || '';
        });
    }

    /* ---- Toast ---- */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = { success: 'fas fa-check-circle', error: 'fas fa-exclamation-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
