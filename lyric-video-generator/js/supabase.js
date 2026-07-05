/* ============================================
   LyricForge — Supabase Integration
   ============================================ */

class LyricForgeSupabase {
    constructor() {
        this.client = null;
        this.initialized = false;
        this.init();
    }

    init() {
        const url = localStorage.getItem('supabaseUrl');
        const key = localStorage.getItem('supabaseKey');

        if (url && key && typeof supabase !== 'undefined') {
            try {
                this.client = supabase.createClient(url, key);
                this.initialized = true;
                this.updateConnectionStatus(true);
            } catch (e) {
                console.warn('Supabase init failed:', e.message);
                this.updateConnectionStatus(false);
            }
        } else {
            this.updateConnectionStatus(false);
        }
    }

    updateConnectionStatus(connected) {
        const el = document.getElementById('connStatus');
        if (!el) return;
        if (connected) {
            el.className = 'connection-status connected';
            el.innerHTML = '<i class="fas fa-circle"></i> Connected';
        } else {
            el.className = 'connection-status disconnected';
            el.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
        }
    }

    isConnected() {
        return this.initialized && this.client !== null;
    }

    getClient() {
        return this.client;
    }

    /* ---- Video Projects CRUD ---- */
    async getVideos() {
        if (!this.isConnected()) return [];
        try {
            const { data, error } = await this.client
                .from('videos')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('Supabase getVideos failed:', e.message);
            return [];
        }
    }

    async getVideo(id) {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('videos')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('Supabase getVideo failed:', e.message);
            return null;
        }
    }

    async saveVideo(videoData) {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('videos')
                .insert([{
                    artist_name: videoData.artistName,
                    song_name: videoData.songName,
                    version: videoData.versionName || '',
                    status: 'draft',
                    config: videoData.config || {},
                    lyrics_count: videoData.lyricsCount || 0,
                    duration: videoData.duration || 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select();
            if (error) throw error;
            return data?.[0] || null;
        } catch (e) {
            console.warn('Supabase saveVideo failed:', e.message);
            return null;
        }
    }

    async updateVideo(id, updates) {
        if (!this.isConnected()) return false;
        try {
            updates.updated_at = new Date().toISOString();
            const { error } = await this.client
                .from('videos')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('Supabase updateVideo failed:', e.message);
            return false;
        }
    }

    async deleteVideo(id) {
        if (!this.isConnected()) return false;
        try {
            const { error } = await this.client
                .from('videos')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('Supabase deleteVideo failed:', e.message);
            return false;
        }
    }

    /* ---- YouTube Upload Requests ---- */
    async getYouTubeRequests() {
        if (!this.isConnected()) return [];
        try {
            const { data, error } = await this.client
                .from('youtube_requests')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('Supabase getYouTubeRequests failed:', e.message);
            return [];
        }
    }

    async createYouTubeRequest(request) {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('youtube_requests')
                .insert([{
                    video_id: request.videoId,
                    title: request.title,
                    description: request.description,
                    tags: request.tags || [],
                    visibility: request.visibility || 'public',
                    status: 'pending',
                    created_at: new Date().toISOString()
                }])
                .select();
            if (error) throw error;
            return data?.[0] || null;
        } catch (e) {
            console.warn('Supabase createYouTubeRequest failed:', e.message);
            return null;
        }
    }

    async updateYouTubeRequest(id, updates) {
        if (!this.isConnected()) return false;
        try {
            const { error } = await this.client
                .from('youtube_requests')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('Supabase updateYouTubeRequest failed:', e.message);
            return false;
        }
    }

    /* ---- Cloud Render Jobs ---- */
    async createRenderJob(jobData) {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('render_jobs')
                .insert([{
                    artist_name: jobData.artistName || '',
                    song_name: jobData.songName || '',
                    config: jobData.config || {},
                    lyrics: jobData.lyrics || [],
                    audio_url: jobData.audioUrl || '',
                    bg_url: jobData.bgUrl || '',
                    lyrics_url: jobData.lyricsUrl || '',
                    audio_duration: jobData.audioDuration || 0,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }])
                .select();
            if (error) throw error;
            return data?.[0] || null;
        } catch (e) {
            console.warn('Supabase createRenderJob failed:', e.message);
            return null;
        }
    }

    async getRenderJob(id) {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('render_jobs')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            return null;
        }
    }

    async getMyRenderJobs(limit = 10) {
        if (!this.isConnected()) return [];
        try {
            const { data, error } = await this.client
                .from('render_jobs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data || [];
        } catch (e) {
            return [];
        }
    }

    /* ---- Settings ---- */
    async getSettings() {
        if (!this.isConnected()) return {};
        try {
            const { data, error } = await this.client
                .from('settings')
                .select('*')
                .single();
            if (error) throw error;
            return data || {};
        } catch (e) {
            return {};
        }
    }

    async saveSettings(settings) {
        if (!this.isConnected()) return false;
        try {
            const { error } = await this.client
                .from('settings')
                .upsert([settings]);
            if (error) throw error;
            return true;
        } catch (e) {
            return false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricForgeSupabase;
}
