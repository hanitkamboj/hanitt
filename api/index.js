/* ============================================
   LyricForge — Vercel Serverless API Entry
   ============================================ */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// CORS — allow any origin for Vercel deployment
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        name: 'LyricForge API',
        version: '1.0.0',
        environment: process.env.VERCEL ? 'vercel' : 'development',
        timestamp: new Date().toISOString()
    });
});

// Mount backend routes
const youtubeRoutes = require('../backend/routes/youtube');
const driveRoutes = require('../backend/routes/drive');
const aiRoutes = require('../backend/routes/ai');

app.use('/api/youtube', youtubeRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.url });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('API error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// For local development
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🎵 LyricForge API running on http://localhost:${PORT}`);
    });
}

module.exports = app;
