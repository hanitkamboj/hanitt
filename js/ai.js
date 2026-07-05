/* ============================================
   LyricForge — AI Integration (DeepSeek API)
   ============================================ */

class LyricForgeAI {
    constructor() {
        this.apiKey = localStorage.getItem('deepseekKey') || '';
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        this.serverUrl = localStorage.getItem('serverUrl') || 'http://localhost:3000';
    }

    getSystemPrompt() {
        return `You are LyricForge AI, an expert assistant for a lyric video generation platform. 

YOUR CAPABILITIES:
1. Fetch and suggest lyrics from LRCLib based on song/artist queries
2. Generate SEO-optimized YouTube descriptions and tags for lyric videos
3. Suggest next songs for artists based on their catalog
4. Analyze uploaded lyrics and suggest improvements or corrections
5. Generate video style recommendations based on song mood/genre
6. Auto-generate credit text and metadata for videos
7. Create engaging YouTube titles with proper formatting: "Artist - Song (Official Lyric Video)"
8. Write description templates following the industry standard format:
   - First line: "Artist - Song (Official Lyric Video)"
   - Credits section with links
   - Lyrics section
   - Social media links
   - Copyright notice

WORKFLOW YOU MUST FOLLOW:
- When a user uploads an audio file without lyrics, suggest fetching from LRCLib
- After lyrics are loaded, automatically analyze them for mood to suggest visual style
- When metadata (artist/song) is provided, generate full YouTube description
- Suggest 2-3 related songs the artist might want to make lyric videos for next
- For SEO, generate relevant tags including: artist name, song title, genre, "lyric video", "official lyric video"

FORMAT RULES FOR DESCRIPTIONS:
- YouTube titles: "Artist - Song (Official Lyric Video)" or "Artist - Song | Lyric Video"
- Tags: Include artist, song, genre, "lyric video", "official video", "with lyrics"
- Descriptions: Credits first, then lyrics, then social links, then copyright

RESPONSE FORMAT:
Always respond with valid JSON when asked for structured data.
Use natural language for conversational responses.`;
    }

    async chat(messages, options = {}) {
        const { temperature = 0.7, maxTokens = 2048 } = options;

        if (!this.apiKey) {
            return this.fallbackResponse(messages);
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: this.getSystemPrompt() },
                        ...messages
                    ],
                    temperature,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (e) {
            console.warn('AI API failed, using fallback:', e.message);
            return this.fallbackResponse(messages);
        }
    }

    fallbackResponse(messages) {
        const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';

        if (lastMsg.includes('description') || lastMsg.includes('seo') || lastMsg.includes('youtube')) {
            return this.generateFallbackDescription(messages);
        }
        if (lastMsg.includes('next song') || lastMsg.includes('suggest')) {
            return JSON.stringify({
                suggestions: [
                    "Another song by the same artist",
                    "Similar genre recommendation",
                    "Popular track from the album"
                ],
                reasoning: "Based on the current song metadata, these tracks would make great follow-up lyric videos."
            });
        }
        if (lastMsg.includes('style') || lastMsg.includes('mood')) {
            return JSON.stringify({
                mood: "uplifting",
                recommendedFontSize: 8,
                recommendedDrift: 15,
                recommendedSpeed: 10,
                colorSuggestion: "#7c3aed",
                reason: "A balanced, energetic style that works well for most pop/rock songs."
            });
        }

        return JSON.stringify({
            message: "AI suggestions generated. Connect a DeepSeek API key in Settings for AI-powered suggestions.",
            suggestions: ["Try connecting an API key for better results"]
        });
    }

    generateFallbackDescription(messages) {
        let artist = 'Artist';
        let song = 'Song';
        let version = '';

        for (const msg of messages) {
            const content = msg.content || '';
            if (content.includes('artist')) {
                const match = content.match(/artist[":\s]+([^"\n,]+)/i);
                if (match) artist = match[1].trim();
            }
            if (content.includes('song')) {
                const match = content.match(/song[":\s]+([^"\n,]+)/i);
                if (match) song = match[1].trim();
            }
            if (content.includes('version')) {
                const match = content.match(/version[":\s]+([^"\n,]+)/i);
                if (match) version = match[1].trim();
            }
        }

        const title = version
            ? `${artist} - ${song} (${version})`
            : `${artist} - ${song} (Official Lyric Video)`;

        return JSON.stringify({
            title,
            description: `${title}\n\n🎵 Listen to more from ${artist}:\n\n📌 Lyrics:\n\n---\n\n🔔 Subscribe for more lyric videos!\n\n© ${new Date().getFullYear()} ${artist}. All rights reserved.`,
            tags: [artist, song, 'lyric video', 'official lyric video', 'music', 'lyrics'].filter(Boolean),
            category: '10',
            privacy: 'public'
        });
    }

    /* ---- SPECIFIC FEATURES ---- */

    async generateDescription(artist, song, version, lyrics) {
        const prompt = `Generate a complete YouTube video description for this lyric video:

Artist: ${artist}
Song: ${song}
Version: ${version || 'Official Lyric Video'}

Lyrics:
${lyrics || 'No lyrics provided'}

Provide title, description, tags, category, and privacy status as JSON.`;

        const result = await this.chat([{ role: 'user', content: prompt }], { temperature: 0.3 });
        try {
            return JSON.parse(result);
        } catch {
            return {
                title: `${artist} - ${song} (${version || 'Official Lyric Video'})`,
                description: result,
                tags: [artist, song, 'lyric video'],
                category: '10',
                privacy: 'public'
            };
        }
    }

    async suggestNextSong(artist, currentSong) {
        const prompt = `Suggest 3 songs that would make great next lyric videos for the artist "${artist}", considering they just made "${currentSong}". 

Return as JSON array with objects containing: songName, reason, estimatedDifficulty (easy/medium/hard).`;

        const result = await this.chat([{ role: 'user', content: prompt }], { temperature: 0.8 });
        try {
            return JSON.parse(result);
        } catch {
            return {
                suggestions: [
                    { songName: "Another Hit", reason: "Popular track by this artist", estimatedDifficulty: "medium" },
                    { songName: "Album Deep Cut", reason: "Fan favorite from the album", estimatedDifficulty: "easy" },
                    { songName: "New Release", reason: "Recent single gaining traction", estimatedDifficulty: "medium" }
                ]
            };
        }
    }

    async suggestStyle(lyrics, artist, song) {
        const prompt = `Analyze these lyrics and suggest a visual style for the lyric video:

Artist: ${artist}
Song: ${song}

Lyrics:
${lyrics}

Return as JSON with: mood, recommendedFontSize (4-12), recommendedDrift (5-40), recommendedSpeed (5-20), colorSuggestion (hex), reason.`;

        const result = await this.chat([{ role: 'user', content: prompt }], { temperature: 0.5 });
        try {
            return JSON.parse(result);
        } catch {
            return {
                mood: "neutral",
                recommendedFontSize: 8,
                recommendedDrift: 15,
                recommendedSpeed: 10,
                colorSuggestion: "#7c3aed",
                reason: "Standard settings for a balanced look."
            };
        }
    }

    async autocomplete(input, context) {
        const prompt = `Given the input "${input}" and context "${context}", suggest completions for a lyric video project.

Return as JSON array of strings with 3-5 suggestions.`;

        const result = await this.chat([{ role: 'user', content: prompt }], { temperature: 0.4, maxTokens: 256 });
        try {
            const parsed = JSON.parse(result);
            return Array.isArray(parsed) ? parsed : parsed.suggestions || [];
        } catch {
            return [];
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricForgeAI;
}
