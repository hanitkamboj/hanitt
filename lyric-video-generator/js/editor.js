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
        this.templates = this.loadTemplates();
        this.chatHistory = [];
        this.isChatProcessing = false;
        this.attachedFiles = [];
    }

    loadTemplates() {
        try { return JSON.parse(localStorage.getItem('lyricforge_templates') || '[]'); }
        catch { return []; }
    }

    saveTemplates() {
        localStorage.setItem('lyricforge_templates', JSON.stringify(this.templates));
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

        // Chat
        document.getElementById('chatSendBtn').addEventListener('click', () => this.chatSend());
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.chatSend(); }
        });
        document.getElementById('chatFileInput').addEventListener('change', (e) => this.chatAttachFile(e));

        // Chat quick actions
        document.querySelectorAll('.chat-action').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('chatInput').value = btn.dataset.prompt;
                this.chatSend();
            });
        });

        // Templates
        document.getElementById('saveTemplateBtn').addEventListener('click', () => this.saveTemplate());
        document.getElementById('importTemplateBtn').addEventListener('click', () => this.importTemplate());
        document.querySelectorAll('.tmpl-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tmpl-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderTemplates(tab.dataset.ttype);
            });
        });

        // Google Sign-In
        document.getElementById('googleSignInBtn')?.addEventListener('click', () => this.googleSignIn());
        document.getElementById('googleSignOutBtn')?.addEventListener('click', () => this.googleSignOut());

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
            fontSize: parseFloat(document.getElementById('fontSize')?.value || '6'),
            textColor: document.getElementById('textColor')?.value || '#ffffff',
            shadowIntensity: parseInt(document.getElementById('shadowIntensity')?.value || '15'),
            animSpeed: parseFloat(document.getElementById('animSpeed')?.value || '10'),
            driftAmount: parseInt(document.getElementById('driftAmount')?.value || '15'),
            fadeInDuration: parseFloat(document.getElementById('fadeInDuration')?.value || '1.5'),
            fadeOutDuration: parseFloat(document.getElementById('fadeOutDuration')?.value || '1.5'),
            maxTextWidth: parseInt(document.getElementById('maxTextWidth')?.value || '85'),
            overlayColor: document.getElementById('overlayColor')?.value || '#6c11c9',
            overlayOpacity: parseFloat(document.getElementById('overlayOpacity')?.value || '0.3'),
            bgBlur: parseInt(document.getElementById('bgBlur')?.value || '5'),
            artistName: document.getElementById('artistName')?.value || '',
            songName: document.getElementById('songName')?.value || '',
            versionName: document.getElementById('versionName')?.value || ''
        };
    }

    setupStyleControls() {
        const rangeIds = ['fontSize', 'shadowIntensity', 'animSpeed', 'driftAmount', 'fadeInDuration', 'fadeOutDuration', 'maxTextWidth', 'overlayOpacity', 'bgBlur'];
        const suffixes = { fontSize: '', shadowIntensity: 'px', animSpeed: 's', driftAmount: 'px', fadeInDuration: 's', fadeOutDuration: 's', maxTextWidth: '%', overlayOpacity: '', bgBlur: 'px' };
        rangeIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                const valEl = document.getElementById(id + 'Val');
                if (valEl) valEl.textContent = el.value + (suffixes[id] || '');
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

    /* ---- AI Chat ---- */
    async chatSend() {
        if (this.isChatProcessing) return;
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        this.addChatMessage('user', text);
        input.value = '';
        this.isChatProcessing = true;

        const thinkingId = this.addThinkingMessage();
        const msgEl = document.getElementById(thinkingId);

        try {
            const ctx = this.buildChatContext();
            this.chatHistory.push({ role: 'user', content: text });

            const result = await this.ai.chat(this.chatHistory.slice(-10), { temperature: 0.7, maxTokens: 2048 });

            this.chatHistory.push({ role: 'assistant', content: result });

            const thinkingMsg = document.getElementById(thinkingId);
            if (thinkingMsg) thinkingMsg.remove();

            this.addChatMessage('ai', result);

            this.processAIResponse(result);
        } catch (e) {
            const thinkingMsg = document.getElementById(thinkingId);
            if (thinkingMsg) thinkingMsg.remove();
            this.addChatMessage('ai', `Sorry, I encountered an error: ${e.message}`);
        }

        this.isChatProcessing = false;
    }

    buildChatContext() {
        const config = this.getStyleFromUI();
        const lyrics = this.lyrics.map(l => `[${LyricsParser.formatTime(l.time)}] ${l.text}`).join('\n');
        return {
            artist: config.artistName,
            song: config.songName,
            version: config.versionName,
            fontFamily: config.fontFamily,
            fontSize: config.fontSize,
            textColor: config.textColor,
            drift: config.driftAmount,
            speed: config.animSpeed,
            fadeIn: config.fadeInDuration,
            fadeOut: config.fadeOutDuration,
            overlayColor: config.overlayColor,
            hasAudio: !!this.audioFile,
            hasBg: !!this.bgImage,
            lyricsCount: this.lyrics.length,
            lyricsPreview: lyrics.substring(0, 500)
        };
    }

    processAIResponse(text) {
        const lower = text.toLowerCase();

        if (lower.includes('fontsize') || lower.includes('font-size') || lower.includes('font size')) {
            const match = text.match(/font.?size[:\s]*(\d+(\.\d+)?)/i);
            if (match) {
                const val = Math.min(10, Math.max(1, parseFloat(match[1])));
                document.getElementById('fontSize').value = val;
                document.getElementById('fontSizeVal').textContent = val;
                this.updatePreview();
                this.showToast(`Font size set to ${val}`, 'success');
            }
        }

        if (lower.includes('drift') || lower.includes('move')) {
            const match = text.match(/drift[:\s]*(\d+)/i);
            if (match) {
                const val = Math.min(40, Math.max(5, parseInt(match[1])));
                document.getElementById('driftAmount').value = val;
                document.getElementById('driftVal').textContent = val + 'px';
                this.updatePreview();
            }
        }

        if (lower.includes('fade') || lower.includes('fade in') || lower.includes('fade out')) {
            const matchIn = text.match(/fade.?in[:\s]*(\d+(\.\d+)?)/i);
            const matchOut = text.match(/fade.?out[:\s]*(\d+(\.\d+)?)/i);
            if (matchIn) {
                const val = Math.min(4, Math.max(0.3, parseFloat(matchIn[1])));
                document.getElementById('fadeInDuration').value = val;
                document.getElementById('fadeInDurationVal').textContent = val + 's';
            }
            if (matchOut) {
                const val = Math.min(4, Math.max(0.3, parseFloat(matchOut[1])));
                document.getElementById('fadeOutDuration').value = val;
                document.getElementById('fadeOutDurationVal').textContent = val + 's';
            }
            this.updatePreview();
        }

        if (lower.includes('#') && lower.includes('overlay')) {
            const match = text.match(/#[0-9a-f]{6}/i);
            if (match) {
                document.getElementById('overlayColor').value = match[0];
                this.updatePreview();
            }
        }

        if (lower.includes('color') || lower.includes('colour')) {
            const match = text.match(/#[0-9a-f]{6}/i);
            if (match) {
                document.getElementById('overlayColor').value = match[0];
                this.updatePreview();
            }
        }

        if (lower.includes('artist') && !lower.includes('suggest')) {
            const match = text.match(/artist[":\s]*([^"\n,.]+)/i);
            if (match && match[1].length < 50) {
                document.getElementById('artistName').value = match[1].trim();
                this.updateMetadata();
            }
        }

        if (lower.includes('song') && !lower.includes('suggest') && !lower.includes('next')) {
            const match = text.match(/song[":\s]*([^"\n,.]+)/i);
            if (match && match[1].length < 50) {
                document.getElementById('songName').value = match[1].trim();
                this.updateMetadata();
            }
        }

        if (lower.includes('description') || lower.includes('seo') || lower.includes('youtube')) {
            this.generateDescription();
        }

        if (lower.includes('suggest') && (lower.includes('style') || lower.includes('visual'))) {
            this.generateAISuggestions();
        }

        if (lower.includes('next song') || (lower.includes('suggest') && lower.includes('song'))) {
            this.suggestNextSong();
        }

        if (lower.includes('template') && (lower.includes('save') || lower.includes('create'))) {
            this.saveTemplate();
        }

        if (lower.includes('fetch') || lower.includes('search') || lower.includes('get lyrics')) {
            const match = text.match(/(?:fetch|search|get)\s+lyrics\s+(?:for\s+)?(.+)/i);
            if (match) {
                document.getElementById('songQuery').value = match[1].trim();
                this.fetchLyrics();
            }
        }
    }

    addChatMessage(role, content) {
        const container = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;

        const avatar = role === 'ai'
            ? '<div class="msg-avatar"><i class="fas fa-robot"></i></div>'
            : '<div class="msg-avatar"><i class="fas fa-user"></i></div>';

        let filesHtml = '';
        if (role === 'user' && this.attachedFiles.length > 0) {
            filesHtml = this.attachedFiles.map(f =>
                `<div class="chat-file-attach"><i class="fas fa-paperclip"></i> ${f.name}</div>`
            ).join('');
            this.attachedFiles = [];
        }

        div.innerHTML = `
            ${avatar}
            <div class="msg-content">
                <p>${this.escapeHtml(content).replace(/\n/g, '<br>')}</p>
                ${filesHtml}
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    addThinkingMessage() {
        const container = document.getElementById('chatMessages');
        const id = 'thinking-' + Date.now();
        const div = document.createElement('div');
        div.className = 'chat-msg ai';
        div.id = id;
        div.innerHTML = `
            <div class="msg-avatar"><i class="fas fa-robot"></i></div>
            <div class="msg-content msg-thinking">
                <div class="dots"><span></span><span></span><span></span></div>
                <div class="msg-status"><i class="fas fa-spinner"></i> Thinking...</div>
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return id;
    }

    chatAttachFile(e) {
        const files = e.target.files;
        if (!files.length) return;
        for (const file of files) {
            this.attachedFiles.push({ name: file.name, size: file.size, type: file.type, file });

            if (file.type.startsWith('audio/')) {
                this.handleAudioUpload(file);
                this.addChatMessage('ai', `📁 Loaded audio file: **${file.name}**`);
            } else if (file.type.startsWith('image/')) {
                this.handleBgUpload(file);
                this.addChatMessage('ai', `📁 Loaded background image: **${file.name}**`);
            } else if (file.name.match(/\.(lrc|srt|ass)$/i)) {
                this.handleLyricsUpload(file);
                this.addChatMessage('ai', `📁 Loaded lyrics file: **${file.name}**`);
            } else {
                this.addChatMessage('ai', `📎 Received file: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`);
            }
        }
        e.target.value = '';
    }

    /* ---- Templates ---- */
    saveTemplate(name) {
        const config = this.getStyleFromUI();
        const templateName = name || prompt('Enter a name for this template:');
        if (!templateName) return;

        const template = {
            id: Date.now().toString(36),
            name: templateName,
            type: this.getActiveTemplateType(),
            config,
            metadata: {
                artistName: config.artistName,
                songName: config.songName,
                versionName: config.versionName
            },
            created: new Date().toISOString()
        };

        this.templates.push(template);
        this.saveTemplates();
        this.renderTemplates(template.type);
        this.showToast(`Template "${templateName}" saved!`, 'success');
        this.addChatMessage('ai', `✅ Template **"${templateName}"** saved! You can apply it anytime from the Templates tab.`);
    }

    getActiveTemplateType() {
        const active = document.querySelector('.tmpl-tab.active');
        return active ? active.dataset.ttype : 'video';
    }

    applyTemplate(id) {
        const tmpl = this.templates.find(t => t.id === id);
        if (!tmpl) return;

        const c = tmpl.config;
        document.getElementById('fontFamily').value = c.fontFamily || 'Amatic SC';
        document.getElementById('fontSize').value = c.fontSize || 6;
        document.getElementById('fontSizeVal').textContent = c.fontSize || 6;
        document.getElementById('textColor').value = c.textColor || '#ffffff';
        document.getElementById('shadowIntensity').value = c.shadowIntensity || 15;
        document.getElementById('shadowVal').textContent = (c.shadowIntensity || 15) + 'px';
        document.getElementById('animSpeed').value = c.animSpeed || 10;
        document.getElementById('animSpeedVal').textContent = (c.animSpeed || 10) + 's';
        document.getElementById('driftAmount').value = c.driftAmount || 15;
        document.getElementById('driftVal').textContent = (c.driftAmount || 15) + 'px';
        document.getElementById('fadeInDuration').value = c.fadeInDuration || 1.5;
        document.getElementById('fadeInDurationVal').textContent = (c.fadeInDuration || 1.5) + 's';
        document.getElementById('fadeOutDuration').value = c.fadeOutDuration || 1.5;
        document.getElementById('fadeOutDurationVal').textContent = (c.fadeOutDuration || 1.5) + 's';
        document.getElementById('maxTextWidth').value = c.maxTextWidth || 85;
        document.getElementById('maxTextWidthVal').textContent = (c.maxTextWidth || 85) + '%';
        document.getElementById('overlayColor').value = c.overlayColor || '#6c11c9';
        document.getElementById('overlayOpacity').value = c.overlayOpacity || 0.3;
        document.getElementById('overlayOpacityVal').textContent = c.overlayOpacity || 0.3;
        document.getElementById('bgBlur').value = c.bgBlur || 5;
        document.getElementById('bgBlurVal').textContent = (c.bgBlur || 5) + 'px';

        if (tmpl.metadata) {
            if (tmpl.metadata.artistName) document.getElementById('artistName').value = tmpl.metadata.artistName;
            if (tmpl.metadata.songName) document.getElementById('songName').value = tmpl.metadata.songName;
            if (tmpl.metadata.versionName) document.getElementById('versionName').value = tmpl.metadata.versionName;
            this.updateMetadata();
        }

        this.updatePreview();
        this.showToast(`Template "${tmpl.name}" applied!`, 'success');
    }

    deleteTemplate(id) {
        this.templates = this.templates.filter(t => t.id !== id);
        this.saveTemplates();
        const active = document.querySelector('.tmpl-tab.active');
        this.renderTemplates(active ? active.dataset.ttype : 'video');
        this.showToast('Template deleted', 'info');
    }

    renderTemplates(type) {
        const container = document.getElementById('templateList');
        const filtered = this.templates.filter(t => t.type === type);

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="template-empty">
                    <i class="fas fa-box-open"></i>
                    <p>No ${type} templates saved yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(t => `
            <div class="template-item" data-id="${t.id}">
                <div class="template-item-info">
                    <h5>${this.escapeHtml(t.name)}</h5>
                    <p>${t.metadata?.songName ? `${t.metadata.artistName || '?'} — ${t.metadata.songName}` : ''} • ${new Date(t.created).toLocaleDateString()}</p>
                </div>
                <div class="template-item-actions">
                    <button class="tmpl-apply" title="Apply template"><i class="fas fa-check"></i></button>
                    <button class="tmpl-delete" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.template-item').forEach(item => {
            item.querySelector('.tmpl-apply').addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyTemplate(item.dataset.id);
            });
            item.querySelector('.tmpl-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTemplate(item.dataset.id);
            });
            item.addEventListener('click', () => this.applyTemplate(item.dataset.id));
        });
    }

    importTemplate() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const tmpl = JSON.parse(ev.target.result);
                    if (tmpl.config) {
                        this.templates.push(tmpl);
                        this.saveTemplates();
                        this.renderTemplates(tmpl.type || 'video');
                        this.showToast(`Template "${tmpl.name}" imported!`, 'success');
                    }
                } catch { this.showToast('Invalid template file', 'error'); }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /* ---- Google Sign-In ---- */
    async googleSignIn() {
        this.showToast('Google Sign-In ready for YouTube & Drive integration.', 'info');
        try {
            const clientId = localStorage.getItem('ytClientId');
            if (!clientId) {
                this.showToast('Set your YouTube Client ID in Settings first.', 'warning');
                return;
            }
            const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/drive.file';
            const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=token&scope=${encodeURIComponent(scope)}&include_granted_scopes=true`;
            window.open(url, 'google-oauth', 'width=600,height=700');
            this.showToast('Google OAuth opened in new window. Complete sign-in there.', 'success');
            document.getElementById('googleSignInBtn').hidden = true;
            document.getElementById('googleSignOutBtn').hidden = false;
            document.getElementById('googleUserInfo').hidden = false;
            document.getElementById('googleName').textContent = 'Connected';
            document.getElementById('googleEmail').textContent = 'YouTube & Drive access granted';
        } catch (e) {
            this.showToast('Google Sign-In failed: ' + e.message, 'error');
        }
    }

    googleSignOut() {
        document.getElementById('googleSignInBtn').hidden = false;
        document.getElementById('googleSignOutBtn').hidden = true;
        document.getElementById('googleUserInfo').hidden = true;
        localStorage.removeItem('google_token');
        this.showToast('Signed out from Google', 'info');
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

            // Generate thumbnail (Song as H1, Artist as H2)
            this.thumbnailBlob = await this.renderer.generateThumbnail();

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
            this.thumbnailBlob = await this.renderer.generateThumbnail();
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
