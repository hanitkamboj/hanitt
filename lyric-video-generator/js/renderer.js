class VideoRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.lyrics = [];
        this.bgImage = null;
        this.config = {};
        this.isRendering = false;
        this.isPreviewing = false;
        this.currentFrame = 0;
        this.totalFrames = 0;
        this.animationId = null;
        this.audioDuration = 0;
        this.onProgress = null;
        this.onComplete = null;
        this.renderedBlob = null;
        this.ffmpeg = null;
    }

    async init(canvasElement, config = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d', { alpha: false });
        this.config = {
            fontFamily: 'Amatic SC', fontSize: 6, textColor: '#ffffff',
            shadowIntensity: 15, animSpeed: 10, driftAmount: 15,
            overlayColor: '#6c11c9', overlayOpacity: 0.3, bgBlur: 5,
            fadeInDuration: 1.5, fadeOutDuration: 1.5, maxTextWidth: 85,
            audioOffset: 0, maxCharsPerLine: 0,
            ...config
        };
        this.canvas.width = 1920;
        this.canvas.height = 1080;

        if (typeof FFmpeg !== 'undefined' && !this.ffmpeg) {
            try {
                const { createFFmpeg, fetchFile } = FFmpeg;
                this.ffmpeg = createFFmpeg({
                    log: false,
                    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
                });
                this.ffmpegFetchFile = fetchFile;
                await this.ffmpeg.load();
            } catch (e) {
                console.warn('ffmpeg.wasm not available:', e.message);
            }
        }
        return this;
    }

    setLyrics(lyrics) {
        this.lyrics = lyrics.map((l, i) => ({
            ...l,
            endTime: i < lyrics.length - 1
                ? lyrics[i + 1].time - Math.min(0.5, (lyrics[i + 1].time - l.time) * 0.15)
                : l.time + 5
        }));
        return this;
    }

    setBackground(image) { this.bgImage = image; return this; }
    setAudio(file) { this.audioFile = file; return this; }
    setDuration(d) { this.audioDuration = d; return this; }
    getStyleConfig() { return { ...this.config }; }
    updateConfig(updates) { Object.assign(this.config, updates); }

    drawFrame(time) {
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);
        this.drawBackground(ctx, w, h);
        this.drawOverlay(ctx, w, h);
        this.drawLyrics(ctx, w, h, time + (this.config.audioOffset || 0));
        this.drawWatermark(ctx, w, h);
    }

    drawBackground(ctx, w, h) {
        if (this.bgImage) {
            ctx.save();
            if (this.config.bgBlur > 0) ctx.filter = `blur(${this.config.bgBlur}px)`;
            ctx.drawImage(this.bgImage, 0, 0, w, h);
            ctx.restore();
        } else {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, this.config.overlayColor || '#6c11c9');
            g.addColorStop(1, this.lightenColor(this.config.overlayColor || '#6c11c9', 40));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }
    }

    drawOverlay(ctx, w, h) {
        if (!this.bgImage) return;
        ctx.fillStyle = this.hexToRgba(this.config.overlayColor || '#6c11c9', this.config.overlayOpacity || 0.3);
        ctx.fillRect(0, 0, w, h);
    }

    drawLyrics(ctx, w, h, time) {
        const speed = this.config.animSpeed || 10;
        const drift = this.config.driftAmount || 15;
        let active = null;
        for (const l of this.lyrics) {
            if (time >= l.time && time < l.endTime) { active = l; break; }
        }
        if (!active) {
            const prev = this.lyrics.filter(l => l.endTime <= time).pop();
            if (prev) {
                const fOut = this.config.fadeOutDuration || 1.5;
                if (time > prev.endTime - fOut && time < prev.endTime) {
                    this.drawSingleLyric(ctx, w, h, prev, time, speed, drift);
                }
            }
            return;
        }
        this.drawSingleLyric(ctx, w, h, active, time, speed, drift);
    }

    drawWatermark(ctx, w, h) {
        const artist = this.config.artistName || '';
        const song = this.config.songName || '';
        if (!artist && !song) return;
        const text = `${artist} — ${song}`;
        const ff = `"${this.config.fontFamily || 'Amatic SC'}", cursive`;
        ctx.save();
        ctx.font = `400 32px ${ff}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha = 0.35;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, w / 2, h - 40);
        ctx.restore();
    }

    drawSingleLyric(ctx, w, h, lyric, time, speed, drift) {
        const elapsed = time - lyric.time;
        const duration = lyric.endTime - lyric.time;
        const fadeIn = Math.min(this.config.fadeInDuration || 1.5, duration * 0.4);
        const fadeOut = Math.min(this.config.fadeOutDuration || 1.5, duration * 0.4);
        const fadeOutStart = lyric.endTime - fadeOut;

        let opacity = 1;
        if (elapsed < fadeIn) opacity = elapsed / fadeIn;
        else if (time > fadeOutStart) opacity = Math.max(0, 1 - (time - fadeOutStart) / fadeOut);

        const cycle = speed;
        const phase = (elapsed % cycle) / cycle;
        const xDrift = Math.sin(phase * Math.PI * 2) * drift;
        const yDrift = Math.sin((phase * Math.PI * 2) - Math.PI / 2) * (drift * 0.8);

        const maxW = (w * (this.config.maxTextWidth || 85)) / 100;
        const baseSize = (this.config.fontSize || 6) * (h / 1080) * 100;
        const fontFamily = `"${this.config.fontFamily}", cursive`;

        let lines = [lyric.text];
        const maxChars = parseInt(this.config.maxCharsPerLine) || 0;
        if (maxChars > 0 && lyric.text.length > maxChars) {
            lines = this.wrapText(lyric.text, maxChars);
        }
        const lineH = 1.3;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let fontSize = baseSize;
        ctx.font = `700 ${fontSize}px ${fontFamily}`;
        let maxLineW = 0;
        for (const line of lines) {
            const lw = ctx.measureText(line).width;
            if (lw > maxLineW) maxLineW = lw;
        }
        if (maxLineW > maxW) {
            fontSize = baseSize * (maxW / maxLineW);
            ctx.font = `700 ${fontSize}px ${fontFamily}`;
        }

        const shadowPx = this.config.shadowIntensity || 15;
        ctx.shadowColor = `rgba(0,0,0,${Math.min(0.8, shadowPx / 20)})`;
        ctx.shadowBlur = shadowPx;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = this.config.textColor || '#ffffff';
        ctx.save();
        ctx.translate(w / 2 + xDrift, h / 2 + yDrift);

        const totalH = lines.length * fontSize * lineH;
        const startY = -(totalH / 2) + (fontSize * lineH * 0.35);
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], 0, startY + i * fontSize * lineH);
        }
        ctx.restore();
        ctx.restore();
    }

    wrapText(text, maxLen) {
        const words = text.split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
            if ((cur + ' ' + w).trim().length <= maxLen) {
                cur = (cur + ' ' + w).trim();
            } else {
                if (cur) lines.push(cur);
                cur = w;
                if (cur.length > maxLen) {
                    while (cur.length > maxLen) {
                        lines.push(cur.substring(0, maxLen));
                        cur = cur.substring(maxLen);
                    }
                }
            }
        }
        if (cur) lines.push(cur);
        return lines.length > 0 ? lines : [text];
    }

    /* ---- PREVIEW ---- */
    startPreview(audioElement) {
        if (this.isPreviewing) return;
        this.isPreviewing = true;
        this.audioElement = audioElement;
        const loop = () => {
            if (!this.isPreviewing) return;
            this.drawFrame(audioElement ? audioElement.currentTime : 0);
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    stopPreview() {
        this.isPreviewing = false;
        if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
    }

    /* ---- RENDER ---- */
    async render(options = {}) {
        if (this.isRendering) throw new Error('Already rendering');
        const { fps = 60, width = 1920, height = 1080, bitrate = 20000000, onProgress = null, onComplete = null } = options;
        this.isRendering = true;
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.renderedBlob = null;
        this.canvas.width = width;
        this.canvas.height = height;

        const duration = this.audioDuration || 30;
        const totalFrames = Math.ceil(duration * fps);
        this.totalFrames = totalFrames;
        this.currentFrame = 0;

        const stream = this.canvas.captureStream(fps);
        const chunks = [];
        const mimeType = this.getSupportedMimeType();
        let mediaRecorder;
        try {
            mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
        } catch {
            mediaRecorder = new MediaRecorder(stream, { videoBitsPerSecond: bitrate });
        }

        const frameInterval = 1000 / fps;

        return new Promise((resolve, reject) => {
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                this.isRendering = false;
                const blob = new Blob(chunks, { type: 'video/webm' });
                this.renderedBlob = blob;
                let finalBlob = blob;
                if (this.audioFile && this.ffmpeg && this.ffmpeg.isLoaded()) {
                    try { finalBlob = await this.mergeAudioWithFFmpeg(blob, this.audioFile); }
                    catch (e) { console.warn('Audio merge failed:', e); }
                }
                if (this.onComplete) this.onComplete(finalBlob);
                resolve(finalBlob);
            };
            mediaRecorder.onerror = (e) => { this.isRendering = false; reject(e); };
            mediaRecorder.start(frameInterval);

            let prevTime = performance.now();
            const renderFrame = (now) => {
                if (!this.isRendering) { if (mediaRecorder.state === 'recording') mediaRecorder.stop(); return; }
                const elapsed = now - prevTime;
                if (elapsed >= frameInterval - 1) {
                    prevTime = now - (elapsed % frameInterval);
                    this.drawFrame(this.currentFrame / fps);
                    this.currentFrame++;
                    if (this.onProgress) {
                        const pct = Math.min(100, (this.currentFrame / totalFrames) * 100);
                        this.onProgress({ percent: pct, frame: this.currentFrame, total: totalFrames, time: this.currentFrame / fps, fps });
                    }
                }
                if (this.currentFrame <= totalFrames) requestAnimationFrame(renderFrame);
                else if (mediaRecorder.state === 'recording') mediaRecorder.stop();
            };
            requestAnimationFrame(renderFrame);
        });
    }

    async mergeAudioWithFFmpeg(videoBlob, audioFile) {
        if (!this.ffmpeg || !this.ffmpeg.isLoaded()) return videoBlob;
        try {
            this.ffmpeg.FS('writeFile', 'video.webm', await this.ffmpegFetchFile(videoBlob));
            this.ffmpeg.FS('writeFile', 'audio.mp3', await this.ffmpegFetchFile(audioFile));
            await this.ffmpeg.run(
                '-i', 'video.webm', '-i', 'audio.mp3',
                '-c:v', 'libx264', '-preset', 'medium',
                '-b:v', '20M', '-maxrate', '25M', '-bufsize', '40M',
                '-c:a', 'aac', '-b:a', '192k',
                '-shortest', '-pix_fmt', 'yuv420p', '-r', '60',
                '-movflags', '+faststart', 'output.mp4'
            );
            const data = this.ffmpeg.FS('readFile', 'output.mp4');
            this.ffmpeg.FS('unlink', 'video.webm');
            this.ffmpeg.FS('unlink', 'audio.mp3');
            return new Blob([data.buffer], { type: 'video/mp4' });
        } catch (e) { console.error('FFmpeg error:', e); return videoBlob; }
    }

    /* ---- THUMBNAIL ---- */
    generateThumbnail() {
        const c = document.createElement('canvas');
        c.width = 1920; c.height = 1080;
        const cx = c.getContext('2d', { alpha: false });

        const renderer = new VideoRenderer();
        renderer.canvas = c; renderer.ctx = cx;
        renderer.config = this.config;
        renderer.bgImage = this.bgImage;
        renderer.drawFrame(0);

        const song = this.config.songName || 'Song Title';
        const artist = this.config.artistName || 'Artist Name';
        const version = this.config.versionName || '';
        const ff = `"${this.config.fontFamily || 'Amatic SC'}", cursive`;

        cx.save();
        cx.textAlign = 'center';

        const songText = version ? `${song} (${version})` : song;
        let songSize = 180;
        cx.font = `700 ${songSize}px ${ff}`;
        let textW = cx.measureText(songText).width;
        if (textW > 1700) {
            songSize = 1700 / textW * songSize;
            cx.font = `700 ${songSize}px ${ff}`;
        }
        cx.shadowColor = 'rgba(0,0,0,0.8)';
        cx.shadowBlur = 20;
        cx.fillStyle = '#ffffff';
        cx.textBaseline = 'middle';
        cx.fillText(songText, 960, 440);

        if (artist) {
            const artSize = Math.max(60, Math.round(songSize * 0.45));
            cx.font = `400 ${artSize}px ${ff}`;
            cx.shadowColor = 'rgba(0,0,0,0.6)';
            cx.shadowBlur = 12;
            cx.globalAlpha = 0.9;
            cx.fillStyle = '#e2e8f0';
            cx.textBaseline = 'top';
            cx.fillText(artist, 960, 520 + songSize * 0.2);
        }

        cx.restore();
        return new Promise(resolve => c.toBlob(b => resolve(b), 'image/jpeg', 0.95));
    }

    /* ---- HELPERS ---- */
    getSupportedMimeType() {
        const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
        for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t; }
        return 'video/webm';
    }

    hexToRgba(hex, a) {
        if (!hex) return `rgba(0,0,0,${a})`;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
    }

    lightenColor(hex, p) {
        if (!hex) return '#a238ff';
        const n = parseInt(hex.slice(1),16), amt = Math.round(2.55*p);
        const R = Math.min(255,(n>>16)+amt), G = Math.min(255,((n>>8)&0xFF)+amt), B = Math.min(255,(n&0xFF)+amt);
        return `#${(0x1000000+R*0x10000+G*0x100+B).toString(16).slice(1)}`;
    }

    cancelRender() { this.isRendering = false; }
}
if (typeof module !== 'undefined' && module.exports) module.exports = VideoRenderer;
