/* ============================================
   LyricForge — Video Renderer (1080p 60fps)
   Uses Canvas + MediaRecorder + ffmpeg.wasm
   ============================================ */

class VideoRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.audioCtx = null;
        this.lyrics = [];
        this.bgImage = null;
        this.config = {};
        this.isRendering = false;
        this.isPreviewing = false;
        this.currentFrame = 0;
        this.totalFrames = 0;
        this.animationId = null;
        this.audioDuration = 0;
        this.audioBuffer = null;
        this.audioSource = null;
        this.startTime = 0;
        this.onProgress = null;
        this.onComplete = null;
        this.renderedBlob = null;
        this.ffmpeg = null;
    }

    async init(canvasElement, config = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d', { alpha: false });
        this.config = {
            fontFamily: 'Amatic SC',
            fontSize: 8,
            textColor: '#ffffff',
            shadowIntensity: 15,
            animSpeed: 10,
            driftAmount: 15,
            overlayColor: '#6c11c9',
            overlayOpacity: 0.3,
            bgBlur: 5,
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
                console.warn('ffmpeg.wasm not available, audio merging disabled:', e.message);
            }
        }

        return this;
    }

    setLyrics(lyrics) {
        this.lyrics = lyrics.map((l, i) => ({
            ...l,
            endTime: i < lyrics.length - 1
                ? lyrics[i + 1].time + (lyrics[i + 1].time - l.time) * 0.3
                : l.time + 4
        }));
        return this;
    }

    setBackground(image) {
        this.bgImage = image;
        return this;
    }

    setAudio(file) {
        this.audioFile = file;
        return this;
    }

    setDuration(duration) {
        this.audioDuration = duration;
        return this;
    }

    getStyleConfig() {
        return { ...this.config };
    }

    updateConfig(updates) {
        Object.assign(this.config, updates);
    }

    /* ---- DRAW A SINGLE FRAME ---- */
    drawFrame(time) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        this.drawBackground(ctx, w, h);
        this.drawOverlay(ctx, w, h);
        this.drawLyrics(ctx, w, h, time);
    }

    drawBackground(ctx, w, h) {
        if (this.bgImage) {
            ctx.save();
            const blur = this.config.bgBlur;
            if (blur > 0) {
                ctx.filter = `blur(${blur}px)`;
            }
            ctx.drawImage(this.bgImage, 0, 0, w, h);
            ctx.restore();
        } else {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, this.config.overlayColor || '#6c11c9');
            grad.addColorStop(1, this.lightenColor(this.config.overlayColor || '#6c11c9', 40));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }
    }

    drawOverlay(ctx, w, h) {
        if (!this.bgImage) return;
        ctx.fillStyle = this.hexToRgba(
            this.config.overlayColor || '#6c11c9',
            this.config.overlayOpacity || 0.3
        );
        ctx.fillRect(0, 0, w, h);
    }

    drawLyrics(ctx, w, h, time) {
        const speed = this.config.animSpeed || 10;
        const drift = this.config.driftAmount || 15;

        let activeLyric = null;
        for (const l of this.lyrics) {
            if (time >= l.time && time < l.endTime) {
                activeLyric = l;
                break;
            }
        }

        if (!activeLyric) {
            const prev = this.lyrics.filter(l => l.endTime <= time).pop();
            if (prev) {
                const fadeOutStart = prev.endTime - 1;
                if (time > fadeOutStart && time < prev.endTime) {
                    this.drawSingleLyric(ctx, w, h, prev, time, speed, drift);
                }
            }
            return;
        }

        this.drawSingleLyric(ctx, w, h, activeLyric, time, speed, drift);
    }

    drawSingleLyric(ctx, w, h, lyric, time, speed, drift) {
        const elapsed = time - lyric.time;
        const duration = lyric.endTime - lyric.time;
        const fadeInDuration = Math.min(1.5, duration * 0.25);
        const fadeOutDuration = Math.min(1.5, duration * 0.25);
        const fadeOutStart = lyric.endTime - fadeOutDuration;

        let opacity = 1;
        if (elapsed < fadeInDuration) {
            opacity = elapsed / fadeInDuration;
        } else if (time > fadeOutStart) {
            opacity = Math.max(0, 1 - (time - fadeOutStart) / fadeOutDuration);
        }

        const cycleDuration = speed;
        const phase = (elapsed % cycleDuration) / cycleDuration;

        const xDrift = Math.sin(phase * Math.PI * 2) * drift;
        const yDrift = Math.sin((phase * Math.PI * 2) - Math.PI / 2) * (drift * 0.8);

        const fontSize = (this.config.fontSize || 8) * (h / 1080) * 100;
        ctx.save();
        ctx.font = `700 ${fontSize}px "${this.config.fontFamily}", cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const shadowPx = this.config.shadowIntensity || 15;
        ctx.shadowColor = `rgba(0, 0, 0, ${Math.min(0.8, shadowPx / 20)})`;
        ctx.shadowBlur = shadowPx;

        ctx.globalAlpha = opacity;

        ctx.fillStyle = this.config.textColor || '#ffffff';
        ctx.translate(w / 2 + xDrift, h / 2 + yDrift);
        ctx.fillText(lyric.text, 0, 0);

        ctx.restore();
    }

    /* ---- PREVIEW ---- */
    startPreview(audioElement) {
        if (this.isPreviewing) return;
        this.isPreviewing = true;
        this.audioElement = audioElement;

        const loop = () => {
            if (!this.isPreviewing) return;
            const time = audioElement ? audioElement.currentTime : 0;
            this.drawFrame(time);
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    stopPreview() {
        this.isPreviewing = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /* ---- RENDER (60fps) ---- */
    async render(options = {}) {
        if (this.isRendering) throw new Error('Already rendering');

        const {
            fps = 60,
            width = 1920,
            height = 1080,
            bitrate = 20000000,
            onProgress = null,
            onComplete = null
        } = options;

        this.isRendering = true;
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.renderedBlob = null;

        this.canvas.width = width;
        this.canvas.height = height;

        const duration = this.audioDuration || 30;
        this.totalFrames = Math.ceil(duration * fps);
        this.currentFrame = 0;

        const stream = this.canvas.captureStream(fps);
        const chunks = [];
        let mediaRecorder;

        const mimeType = this.getSupportedMimeType();

        try {
            mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: bitrate
            });
        } catch (e) {
            mediaRecorder = new MediaRecorder(stream, {
                videoBitsPerSecond: bitrate
            });
        }

        return new Promise((resolve, reject) => {
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                this.isRendering = false;
                const blob = new Blob(chunks, { type: 'video/webm' });
                this.renderedBlob = blob;

                let finalBlob = blob;

                if (this.audioFile && this.ffmpeg && this.ffmpeg.isLoaded()) {
                    try {
                        finalBlob = await this.mergeAudioWithFFmpeg(blob, this.audioFile);
                    } catch (e) {
                        console.warn('Audio merge failed, returning video-only:', e);
                    }
                }

                if (this.onComplete) this.onComplete(finalBlob);
                resolve(finalBlob);
            };

            mediaRecorder.onerror = (e) => {
                this.isRendering = false;
                reject(e);
            };

            mediaRecorder.start(1000 / fps);

            const renderFrame = (timestamp) => {
                if (!this.isRendering) {
                    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
                    return;
                }

                const time = this.currentFrame / fps;
                this.drawFrame(time);

                this.currentFrame++;

                if (this.onProgress) {
                    const pct = Math.min(100, (this.currentFrame / this.totalFrames) * 100);
                    this.onProgress({
                        percent: pct,
                        frame: this.currentFrame,
                        total: this.totalFrames,
                        time,
                        fps
                    });
                }

                if (this.currentFrame <= this.totalFrames) {
                    requestAnimationFrame(renderFrame);
                } else {
                    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
                }
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
                '-i', 'video.webm',
                '-i', 'audio.mp3',
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-b:v', '20M',
                '-maxrate', '25M',
                '-bufsize', '40M',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                '-pix_fmt', 'yuv420p',
                '-r', '60',
                '-movflags', '+faststart',
                'output.mp4'
            );

            const data = this.ffmpeg.FS('readFile', 'output.mp4');
            this.ffmpeg.FS('unlink', 'video.webm');
            this.ffmpeg.FS('unlink', 'audio.mp3');

            return new Blob([data.buffer], { type: 'video/mp4' });
        } catch (e) {
            console.error('FFmpeg merge error:', e);
            return videoBlob;
        }
    }

    /* ---- THUMBNAIL ---- */
    generateThumbnail(time = 2) {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 1920;
        thumbCanvas.height = 1080;
        const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });

        const renderer = new VideoRenderer();
        renderer.canvas = thumbCanvas;
        renderer.ctx = thumbCtx;
        renderer.config = this.config;
        renderer.bgImage = this.bgImage;
        renderer.lyrics = this.lyrics;
        renderer.drawFrame(time);

        const metadata = {
            artist: this.config.artistName || '',
            song: this.config.songName || '',
            version: this.config.versionName || ''
        };
        if (metadata.artist || metadata.song) {
            const fontSize = 36;
            thumbCtx.save();
            thumbCtx.font = `700 ${fontSize}px "${this.config.fontFamily}", cursive`;
            thumbCtx.textAlign = 'center';
            thumbCtx.textBaseline = 'bottom';

            const creditText = metadata.version
                ? `${metadata.artist} — ${metadata.song} • ${metadata.version}`
                : `${metadata.artist} — ${metadata.song}`;

            thumbCtx.shadowColor = 'rgba(0,0,0,0.8)';
            thumbCtx.shadowBlur = 10;
            thumbCtx.fillStyle = 'rgba(255,255,255,0.7)';
            thumbCtx.font = `400 ${Math.floor(fontSize * 0.6)}px Inter, sans-serif`;
            thumbCtx.fillText(creditText, 960, 1040);
            thumbCtx.restore();
        }

        return new Promise((resolve) => {
            thumbCanvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.95);
        });
    }

    /* ---- HELPERS ---- */
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'video/webm';
    }

    hexToRgba(hex, alpha) {
        if (!hex) return `rgba(0,0,0,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    lightenColor(hex, percent) {
        if (!hex) return '#a238ff';
        const num = parseInt(hex.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    cancelRender() {
        this.isRendering = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoRenderer;
}
