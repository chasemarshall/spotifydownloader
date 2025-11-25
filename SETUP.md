# Sonata Setup Guide

## ✅ Installation Complete!

Good news! You've already installed everything you need:
- ✅ Python 3 installed
- ✅ spotdl 4.3.1 installed
- ✅ FFmpeg downloaded

### Quick Start

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Open your browser** to `http://localhost:3000`

3. **Paste a Spotify URL** and start downloading!

### PATH Configuration (Already Done!)

The Python bin directory has been added to your `~/.zprofile`. If spotdl isn't working, restart your terminal or run:

```bash
export PATH="/Users/chase/Library/Python/3.9/bin:$PATH"
```

### Set up Spotify API (Required)

You need Spotify API credentials to fetch track information:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app name and description
5. Copy your **Client ID** and **Client Secret**

### Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

## Running the Application

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** to `http://localhost:3000`

## How It Works

1. **Paste a Spotify track or playlist URL** into the input field
2. **Click "get info"** to fetch track details
3. **Click "download mp3"** to start the download
4. spotdl will:
   - Find the best matching audio on YouTube
   - Download the highest quality audio
   - Convert it to MP3 format
   - Add metadata (title, artist, album art)

## Troubleshooting

### Downloads not working?

- Make sure spotdl is installed: `spotdl --version`
- Make sure FFmpeg is installed: `ffmpeg -version`
- Check the browser console for error messages

### "No download tools available" error?

- This means spotdl is not installed or not in your PATH
- Reinstall: `pip install spotdl`
- Verify: `which spotdl` (macOS/Linux) or `where spotdl` (Windows)

### Slow downloads?

- This is normal - spotdl needs to:
  1. Search YouTube for the best match
  2. Download the audio
  3. Convert to MP3
  4. Add metadata
- Typical download time: 30-60 seconds per song

## Optional: yt-dlp Fallback

If you want a fallback option, you can also install yt-dlp:

```bash
pip install yt-dlp
```

The app will automatically use yt-dlp if spotdl is not available (though spotdl is recommended).
