/* ============================================
   LyricForge — Google Drive Upload Routes
   ============================================ */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// POST /api/drive/upload
router.post('/upload', async (req, res) => {
    try {
        const { videoBase64, filename, folderId, token } = req.body;

        if (!videoBase64) {
            return res.status(400).json({ error: 'No video data provided' });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.DRIVE_CLIENT_ID,
            process.env.DRIVE_CLIENT_SECRET,
            process.env.DRIVE_REDIRECT_URI || 'http://localhost:3000/api/drive/callback'
        );

        if (token) {
            oauth2Client.setCredentials(token);
        } else if (process.env.DRIVE_ACCESS_TOKEN) {
            oauth2Client.setCredentials({ access_token: process.env.DRIVE_ACCESS_TOKEN });
        } else {
            return res.status(401).json({
                error: 'Drive not configured',
                message: 'Set DRIVE_ACCESS_TOKEN in environment or provide OAuth token'
            });
        }

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const buffer = Buffer.from(videoBase64, 'base64');

        const fileMetadata = {
            name: filename || `lyric-video-${Date.now()}.mp4`,
            parents: folderId ? [folderId] : []
        };

        const media = {
            mimeType: 'video/mp4',
            body: require('stream').Readable.from(buffer)
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink'
        });

        res.json({
            success: true,
            fileId: response.data.id,
            name: response.data.name,
            url: response.data.webViewLink
        });
    } catch (e) {
        console.error('Drive upload error:', e.message);
        res.status(500).json({ error: 'Drive upload failed', message: e.message });
    }
});

// POST /api/drive/auth
router.post('/auth', async (req, res) => {
    try {
        const { code } = req.body;
        const oauth2Client = new google.auth.OAuth2(
            process.env.DRIVE_CLIENT_ID,
            process.env.DRIVE_CLIENT_SECRET,
            process.env.DRIVE_REDIRECT_URI || 'http://localhost:3000/api/drive/callback'
        );

        const { tokens } = await oauth2Client.getToken(code);
        res.json({ tokens });
    } catch (e) {
        res.status(500).json({ error: 'Drive auth failed', message: e.message });
    }
});

module.exports = router;
