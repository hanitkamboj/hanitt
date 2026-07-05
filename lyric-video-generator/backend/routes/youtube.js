/* ============================================
   LyricForge — YouTube Upload Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// POST /api/youtube/auth
router.post('/auth', async (req, res) => {
    try {
        const { code } = req.body;
        const oauth2Client = new google.auth.OAuth2(
            process.env.YT_CLIENT_ID,
            process.env.YT_CLIENT_SECRET,
            process.env.YT_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback'
        );

        const { tokens } = await oauth2Client.getToken(code);
        res.json({ tokens });
    } catch (e) {
        console.error('YouTube auth error:', e.message);
        res.status(500).json({ error: 'YouTube auth failed', message: e.message });
    }
});

// POST /api/youtube/upload
router.post('/upload', async (req, res) => {
    try {
        const { title, description, tags, category, visibility, videoBase64, token } = req.body;

        if (!videoBase64 && !req.file) {
            return res.status(400).json({ error: 'No video provided' });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.YT_CLIENT_ID,
            process.env.YT_CLIENT_SECRET,
            process.env.YT_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback'
        );

        if (token) {
            oauth2Client.setCredentials(token);
        } else if (process.env.YT_ACCESS_TOKEN) {
            oauth2Client.setCredentials({ access_token: process.env.YT_ACCESS_TOKEN });
        } else {
            return res.status(401).json({
                error: 'YouTube not configured',
                message: 'Set YT_ACCESS_TOKEN in environment or provide OAuth token'
            });
        }

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        const response = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: title || 'Lyric Video',
                    description: description || '',
                    tags: tags || [],
                    categoryId: category || '10'
                },
                status: {
                    privacyStatus: visibility || 'public',
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: videoBase64
                    ? Buffer.from(videoBase64, 'base64')
                    : require('fs').createReadStream(req.file.path)
            }
        });

        res.json({
            success: true,
            videoId: response.data.id,
            url: `https://youtube.com/watch?v=${response.data.id}`
        });
    } catch (e) {
        console.error('YouTube upload error:', e.message);
        res.status(500).json({ error: 'YouTube upload failed', message: e.message });
    }
});

// GET /api/youtube/callback — OAuth callback
router.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (code) {
        res.json({ code });
    } else {
        res.status(400).json({ error: 'No authorization code' });
    }
});

module.exports = router;
