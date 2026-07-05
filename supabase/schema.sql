-- ============================================
-- LyricForge — Supabase Schema
-- ============================================

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_name TEXT NOT NULL DEFAULT '',
    song_name TEXT NOT NULL DEFAULT '',
    version TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    config JSONB DEFAULT '{}',
    lyrics_count INTEGER DEFAULT 0,
    duration FLOAT DEFAULT 0,
    thumbnail_url TEXT DEFAULT '',
    video_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Public access policy (adjust for production)
CREATE POLICY "Public access for videos"
    ON videos FOR ALL
    USING (true)
    WITH CHECK (true);

-- YouTube upload requests
CREATE TABLE IF NOT EXISTS youtube_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    visibility TEXT DEFAULT 'public',
    status TEXT DEFAULT 'pending',
    youtube_url TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE youtube_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access for youtube_requests"
    ON youtube_requests FOR ALL
    USING (true)
    WITH CHECK (true);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access for settings"
    ON settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_artist ON videos(artist_name);
CREATE INDEX IF NOT EXISTS idx_videos_song ON videos(song_name);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_status ON youtube_requests(status);

-- Auto-update function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_youtube_requests_updated_at
    BEFORE UPDATE ON youtube_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
