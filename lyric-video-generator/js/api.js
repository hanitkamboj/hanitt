/* ============================================
   LyricForge — API Utilities & LRCLib
   ============================================ */

class LyricForgeAPI {
    constructor() {
        this.lrclibUrl = 'https://lrclib.net/api';
        this.serverUrl = this.detectServerUrl();
    }

    detectServerUrl() {
        const stored = localStorage.getItem('serverUrl');
        if (stored) return stored;
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            return window.location.origin;
        }
        return 'http://localhost:3000';
    }

    /* ---- LRCLib Integration ---- */
    async searchLyrics(query) {
        try {
            const response = await fetch(
                `${this.lrclibUrl}/search?q=${encodeURIComponent(query)}`,
                { headers: { 'User-Agent': 'LyricForge/1.0' } }
            );
            if (!response.ok) throw new Error(`LRCLib error: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.warn('LRCLib search failed:', e.message);
            return [];
        }
    }

    async getLyrics(id) {
        try {
            const response = await fetch(
                `${this.lrclibUrl}/get/${id}`,
                { headers: { 'User-Agent': 'LyricForge/1.0' } }
            );
            if (!response.ok) throw new Error(`LRCLib error: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.warn('LRCLib get failed:', e.message);
            return null;
        }
    }

    async getLyricsByTrackName(artist, song) {
        try {
            const query = `${artist} ${song}`;
            const results = await this.searchLyrics(query);
            if (results.length > 0) {
                const best = results[0];
                if (best.id) return await this.getLyrics(best.id);
                return best;
            }
            return null;
        } catch (e) {
            console.warn('LRCLib track lookup failed:', e.message);
            return null;
        }
    }

    /* ---- Backend API Proxy ---- */
    async callBackend(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (body) options.body = JSON.stringify(body);

            const response = await fetch(`${this.serverUrl}/api/${endpoint}`, options);
            if (!response.ok) throw new Error(`Backend error: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.warn(`Backend ${endpoint} failed:`, e.message);
            return null;
        }
    }

    /* ---- YouTube Upload (via backend) ---- */
    async uploadToYouTube(videoBlob, metadata, token) {
        if (token) {
            return await this.callBackend('youtube/upload', 'POST', {
                metadata,
                token
            });
        }
        return await this.callBackend('youtube/upload', 'POST', {
            videoBlob: await this.blobToBase64(videoBlob),
            metadata
        });
    }

    /* ---- Drive Upload (via backend) ---- */
    async uploadToDrive(videoBlob, filename, folderId) {
        return await this.callBackend('drive/upload', 'POST', {
            videoBlob: await this.blobToBase64(videoBlob),
            filename,
            folderId
        });
    }

    /* ---- Audio Duration ---- */
    getAudioDuration(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.src = URL.createObjectURL(file);
            audio.addEventListener('loadedmetadata', () => {
                resolve(audio.duration);
                URL.revokeObjectURL(audio.src);
            });
            audio.addEventListener('error', () => resolve(30));
        });
    }

    /* ---- Helpers ---- */
    blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
    }

    formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricForgeAPI;
}
