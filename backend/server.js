/* ============================================
   LyricForge — Backend Server
   Express.js API for YouTube, Drive, AI
   ============================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Multer for file uploads
const upload = multer({
    dest: path.join(__dirname, 'uploads'),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Routes
const youtubeRoutes = require('./routes/youtube');
const driveRoutes = require('./routes/drive');
const aiRoutes = require('./routes/ai');

app.use('/api/youtube', youtubeRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        name: 'LyricForge Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log(`🎵 LyricForge Backend running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   GET  /api/health`);
    console.log(`   POST /api/youtube/upload`);
    console.log(`   POST /api/youtube/auth`);
    console.log(`   POST /api/drive/upload`);
    console.log(`   POST /api/ai/chat`);
    console.log(`   POST /api/ai/description`);
    console.log(`   POST /api/ai/suggest`);
});
