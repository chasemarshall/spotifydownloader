# Spotify Downloader

A Next.js web application for downloading music from Spotify.

## Installation

### Prerequisites

This application requires **spotDL** to be installed on your system for the best download experience.

#### Install spotDL

**Option 1: Using pip (Recommended)**
```bash
pip install spotdl
```

**Option 2: Upgrade existing installation**
```bash
pip install --upgrade spotdl
```

**Option 3: Using pipx (isolated environment)**
```bash
pipx install spotdl
```

#### Install FFmpeg (Required by spotDL)

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use:
```bash
spotdl --download-ffmpeg
```

#### Verify Installation
```bash
spotdl --version
```

### Fallback Options

If spotDL is not available, the application will automatically fall back to:
1. **yt-dlp** (install with `pip install yt-dlp`)
2. **play-dl** (Node.js library, already included)
3. **ytdl-core** (Node.js library, already included)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Usage

1. Start the development server
2. Open [http://localhost:3000](http://localhost:3000)
3. Search for Spotify tracks or playlists
4. Click download to get your music

## Features

- Download individual Spotify tracks
- Download entire playlists
- High-quality MP3 output (320kbps with spotDL)
- Automatic metadata embedding (title, artist, album art)
- Real-time download progress
- Multiple fallback methods for reliability

## Download Quality Priority

1. **spotDL** - Best quality (320kbps MP3) with full metadata
2. **yt-dlp** - High quality audio extraction
3. **play-dl** / **ytdl-core** - Serverless fallback options
