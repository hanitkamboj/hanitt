/* ============================================
   LyricForge — AI Proxy Routes (DeepSeek)
   ============================================ */

const express = require('express');
const router = express.Router();

const AI_PROMPT = `You are LyricForge AI, an expert assistant for a lyric video generation platform. 

YOUR CAPABILITIES:
1. Fetch and suggest lyrics from LRCLib based on song/artist queries
2. Generate SEO-optimized YouTube descriptions and tags for lyric videos
3. Suggest next songs for artists based on their catalog
4. Analyze uploaded lyrics and suggest improvements or corrections
5. Generate video style recommendations based on song mood/genre
6. Auto-generate credit text and metadata for videos
7. Create engaging YouTube titles with proper formatting: "Artist - Song (Official Lyric Video)"
8. Write description templates following the industry standard format

WORKFLOW YOU MUST FOLLOW:
- When a user uploads an audio file without lyrics, suggest fetching from LRCLib
- After lyrics are loaded, automatically analyze them for mood to suggest visual style
- When metadata (artist/song) is provided, generate full YouTube description
- Suggest 2-3 related songs the artist might want to make lyric videos for next
- For SEO, generate relevant tags including: artist name, song title, genre, "lyric video"

THE PLATFORM:
- Resolution: 1920x1080 (1080p) at 60fps
- Animation: Oval drift with fade in/out effects
- Font: Amatic SC (configurable)
- Video bitrate: 20 Mbps
- Output: MP4 with H.264 + AAC
- Integrations: LRCLib, YouTube, Google Drive, Supabase

Always respond with valid JSON when asked for structured data.
Use natural language for conversational responses.`;

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
    try {
        const { messages, apiKey } = req.body;

        const key = apiKey || process.env.DEEPSEEK_API_KEY;
        if (!key) {
            return res.status(401).json({
                error: 'DeepSeek API key not configured',
                message: 'Set DEEPSEEK_API_KEY in environment or provide in request'
            });
        }

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: AI_PROMPT },
                    ...(messages || [])
                ],
                temperature: req.body.temperature || 0.7,
                max_tokens: req.body.maxTokens || 2048
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API error: ${response.status} — ${err}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error('AI chat error:', e.message);
        res.status(500).json({ error: 'AI request failed', message: e.message });
    }
});

// POST /api/ai/description
router.post('/description', async (req, res) => {
    try {
        const { artist, song, version, lyrics, apiKey } = req.body;

        const key = apiKey || process.env.DEEPSEEK_API_KEY;
        if (!key) {
            // Fallback: generate template description
            const title = version
                ? `${artist || 'Artist'} - ${song || 'Song'} (${version})`
                : `${artist || 'Artist'} - ${song || 'Song'} (Official Lyric Video)`;

            return res.json({
                title,
                description: `${title}\n\n🎵 Listen to more from ${artist || 'the artist'}:\n\n📌 Lyrics:\n${lyrics || ''}\n\n---\n\n🔔 Subscribe for more lyric videos!\n\n© ${new Date().getFullYear()} ${artist || 'Artist'}. All rights reserved.`,
                tags: [artist, song, 'lyric video', 'official lyric video'].filter(Boolean),
                category: '10',
                privacy: 'public'
            });
        }

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: AI_PROMPT },
                    { role: 'user', content: `Generate a complete YouTube video description for:\nArtist: ${artist || 'Unknown'}\nSong: ${song || 'Unknown'}\nVersion: ${version || 'Official Lyric Video'}\n\nLyrics:\n${lyrics || 'Not provided'}\n\nReturn as JSON: title, description, tags (array), category, privacy` }
                ],
                temperature: 0.3,
                max_tokens: 2048
            })
        });

        if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);

        const data = await response.json();
        const content = data.choices[0].message.content;
        try {
            res.json(JSON.parse(content));
        } catch {
            res.json({ description: content });
        }
    } catch (e) {
        console.error('Description generation error:', e.message);
        res.status(500).json({ error: 'Description generation failed', message: e.message });
    }
});

// POST /api/ai/suggest
router.post('/suggest', async (req, res) => {
    try {
        const { artist, song, type, apiKey } = req.body;

        const key = apiKey || process.env.DEEPSEEK_API_KEY;
        if (!key) {
            return res.json({
                suggestions: [
                    { songName: "Another Hit", reason: "Popular track by this artist", difficulty: "medium" },
                    { songName: "Album Deep Cut", reason: "Fan favorite", difficulty: "easy" }
                ]
            });
        }

        const prompt = type === 'style'
            ? `Suggest visual style for "${song}" by ${artist}. Return JSON with: mood, fontSize (4-12), drift (5-40), speed (5-20), color, reason.`
            : `Suggest 3 next songs for lyric videos by "${artist}" who just made "${song}". Return JSON array with: songName, reason, difficulty.`;

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: AI_PROMPT },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 1024
            })
        });

        if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);

        const data = await response.json();
        const content = data.choices[0].message.content;
        try {
            res.json(JSON.parse(content));
        } catch {
            res.json({ suggestions: [content] });
        }
    } catch (e) {
        console.error('Suggestion error:', e.message);
        res.status(500).json({ error: 'Suggestion failed', message: e.message });
    }
});

module.exports = router;
