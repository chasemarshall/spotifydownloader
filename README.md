# Spotify Downloader

A Next.js web application for downloading music from Spotify, optimized for serverless deployment on Vercel.

## Features

- ✅ **Serverless-Ready**: Works perfectly on Vercel and other serverless platforms
- ✅ **No System Dependencies**: Pure Node.js solution using youtubei.js
- ✅ **High-Quality Audio**: Downloads best available audio quality from YouTube
- ✅ **Real-Time Progress**: Live progress updates during download
- ✅ **Automatic Fallback**: Tries alternative search queries if initial search fails
- ✅ **Clean UI**: Modern, responsive interface built with Next.js and Tailwind CSS

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/spotify-downloader)

Or manually:
```bash
npm run build
vercel deploy
```

## How It Works

1. **Search**: User searches for Spotify tracks or enters track information
2. **YouTube Search**: The app searches YouTube for the matching audio
3. **Download**: Downloads high-quality audio using YouTube's InnerTube API
4. **Deliver**: Streams the audio file to the user's browser

## Technology Stack

- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS with Framer Motion
- **Audio Download**: youtubei.js (YouTube InnerTube API)
- **Deployment**: Optimized for Vercel serverless functions

## Why youtubei.js?

This project uses [youtubei.js](https://github.com/LuanRT/YouTube.js) instead of traditional CLI tools like yt-dlp or spotDL because:

- ✅ **Serverless Compatible**: Works in Vercel, Netlify, AWS Lambda, etc.
- ✅ **No External Dependencies**: Pure JavaScript, no FFmpeg or Python required
- ✅ **Actively Maintained**: Regular updates to work with YouTube's latest API
- ✅ **Reliable**: Uses YouTube's official InnerTube API
- ✅ **Fast**: Direct streaming without temporary files

## Development Scripts

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Deployment Notes

### Vercel Configuration

The app works out-of-the-box on Vercel with no special configuration. The download API route is automatically deployed as a serverless function.

### Memory Limits

For large files, ensure your serverless function has adequate memory:
- Vercel Pro: Up to 3008 MB
- Vercel Hobby: 1024 MB (default)

### Timeout Settings

Downloads are designed to complete within Vercel's timeout limits:
- Vercel Hobby: 10 seconds
- Vercel Pro: 60 seconds (configurable)

If you need longer timeouts, upgrade to Vercel Pro and configure in `vercel.json`:

```json
{
  "functions": {
    "src/app/api/download/route.ts": {
      "maxDuration": 60
    }
  }
}
```

## Common Issues

### Downloads Timing Out

If downloads are timing out on Vercel's free tier, consider:
1. Upgrading to Vercel Pro for longer function execution time
2. Implementing client-side streaming (work in progress)
3. Using edge functions for better performance

### Audio Quality

The app downloads the best available audio quality from YouTube. Typical formats:
- **M4A**: 128-256 kbps AAC (most common)
- **WEBM**: 128-160 kbps Opus

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is for educational purposes. Users are responsible for complying with copyright laws and YouTube's Terms of Service.

## Acknowledgments

- [youtubei.js](https://github.com/LuanRT/YouTube.js) - YouTube InnerTube API client
- [Next.js](https://nextjs.org/) - React framework
- [Vercel](https://vercel.com/) - Hosting platform
