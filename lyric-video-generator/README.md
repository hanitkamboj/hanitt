# LyricForge — Advanced Lyric Video Generator

Generate stunning 1080p 60fps lyric videos with smooth fade in/out and oval drift animations.

## Features

- **Upload & Generate** — Upload audio (MP3, WAV, M4A), lyrics (LRC, SRT, ASS), and background images
- **Auto-Fetch Lyrics** — Search and fetch synced lyrics from LRCLib
- **Smooth Animations** — Text fade in/out with oval drift effect using Amatic SC font
- **1080p 60fps Rendering** — High-quality video output with 20 Mbps bitrate
- **AI-Powered** — Style suggestions, mood detection, SEO descriptions, next-song recommendations
- **Thumbnail Generator** — Auto-generate thumbnails with credits overlay
- **YouTube Upload** — Direct upload with auto-generated descriptions and tags
- **Google Drive Upload** — Auto-save rendered videos to Drive
- **Dashboard** — Manage all projects via Supabase
- **Download** — Direct video download after rendering

## Quick Start

### Option 1: Open directly (static frontend)

Open `index.html` in a browser. The frontend works independently for:
- Audio/lyrics/image upload
- Video rendering (1080p 60fps)
- LRCLib lyrics search
- Direct download

### Option 2: Full stack with backend

1. **Start the backend:**

```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
npm install
npm start
```

2. Open `index.html` or serve with any HTTP server:

```bash
npx serve .
```

## Configuration

Set these in the app's Settings modal or via `.env`:

| Setting | Where | Purpose |
|---------|-------|---------|
| Supabase URL + Key | Settings | Database for video management |
| DeepSeek API Key | Settings | AI suggestions & SEO generation |
| YouTube API Key | Settings | YouTube upload |
| Drive Folder ID | Settings | Google Drive auto-upload |
| Server URL | Settings | Backend API proxy |

## Deployment

### GitHub Pages (Frontend Only)

The frontend auto-deploys to GitHub Pages via GitHub Actions.

1. Push to `main` branch
2. Enable GitHub Pages in repo Settings → Pages → Source: GitHub Actions
3. Access at `https://<username>.github.io/<repo>/`

### Backend Server

Deploy the `backend/` directory to any Node.js host:
- Render
- Railway
- Fly.io
- VPS

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Rendering**: Canvas API + MediaRecorder + ffmpeg.wasm
- **Font**: Amatic SC (Google Fonts)
- **AI**: DeepSeek API via opencode Zen DeepSeek V4 Flash
- **Database**: Supabase (PostgreSQL)
- **Backend**: Node.js + Express
- **APIs**: LRCLib, YouTube Data API, Google Drive API

## Project Structure

```
lyric-video-generator/
├── index.html          # Main application
├── dashboard.html      # Project dashboard
├── css/
│   ├── style.css       # Main styles
│   └── dashboard.css   # Dashboard styles
├── js/
│   ├── app.js          # App entry point
│   ├── editor.js       # Editor controller
│   ├── renderer.js     # Video renderer (1080p 60fps)
│   ├── lyrics-parser.js # LRC/SRT/ASS parser
│   ├── ai.js           # AI integration
│   ├── api.js          # API utilities + LRCLib
│   └── supabase.js     # Supabase client
├── backend/
│   ├── server.js       # Express server
│   ├── package.json
│   └── routes/
│       ├── youtube.js  # YouTube upload
│       ├── drive.js    # Drive upload
│       └── ai.js       # AI proxy
├── supabase/
│   └── schema.sql      # Database schema
└── .github/workflows/  # CI/CD
```

## License

MIT
