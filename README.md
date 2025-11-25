# Sonata 🎵

A beautiful Spotify downloader built with Next.js that converts Spotify tracks and playlists to MP3 files.

![Sonata](https://img.shields.io/badge/status-ready-brightgreen)

## Features

- 🎵 Download individual Spotify tracks as MP3
- 📝 Download entire playlists
- 🎨 Beautiful, modern UI with animated gradients
- 📊 Real-time download progress tracking
- 🎯 Automatic metadata tagging (artist, title, album art)
- 💜 Purple-themed aesthetic

## How It Works

1. **Paste** a Spotify track or playlist URL
2. **Fetch** track metadata from Spotify's API
3. **Download** using spotdl (automatically finds the best YouTube match)
4. **Convert** to MP3 with embedded metadata and album art
5. **Save** directly to your device

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **spotdl** - Music downloader (Python)
- **Spotify Web API** - Track metadata

## Quick Start

The app is currently running at **http://localhost:3000**

To restart it later:
```bash
npm run dev
```

## Setup Details

See [SETUP.md](./SETUP.md) for complete installation instructions.

### Prerequisites Already Installed ✅
- Python 3.14
- spotdl 4.3.1
- FFmpeg
- Node.js & npm

### Environment Variables Required

Create a `.env` file with your Spotify API credentials:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

Get credentials from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

## Usage

1. Go to http://localhost:3000
2. Paste a Spotify URL (track or playlist)
3. Click "get info"
4. Click "download mp3" on any track
5. Wait for processing (typically 30-60 seconds)
6. Click "save file" when complete

## Download Process

The download works in stages:

1. **Searching** (20%) - Finding best YouTube match
2. **Downloading** (40-90%) - Fetching audio from YouTube
3. **Converting** (95%) - Converting to MP3 with metadata
4. **Complete** (100%) - Ready to save!

## Troubleshooting

### Downloads not working?

Make sure spotdl is in your PATH:
```bash
export PATH="/Users/chase/Library/Python/3.9/bin:$PATH"
spotdl --version
```

### Server won't start?

```bash
npm install
npm run dev
```

### Spotify API errors?

Check that your `.env` file has valid credentials from Spotify Developer Dashboard.

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── download/route.ts    # Download endpoint
│   │   │   ├── track/route.ts       # Track info endpoint
│   │   │   └── playlist/route.ts    # Playlist info endpoint
│   │   ├── page.tsx                 # Main UI
│   │   └── layout.tsx
│   └── lib/
│       └── spotify.ts               # Spotify API client
├── SETUP.md                         # Setup guide
└── README.md                        # This file
```

## Contributing

Feel free to open issues or submit PRs!

## License

MIT

## Support

If you like this project, consider [buying me a coffee](https://ko-fi.com/chasemarsh) ☕

---

Made with 💜 by Chase
