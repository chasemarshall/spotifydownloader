import { NextRequest } from "next/server";
import { spawn, execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

interface DownloadRequest {
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number;
  spotifyUrl?: string;
}

function sendEvent(
  controller: ReadableStreamDefaultController,
  data: {
    stage: string;
    progress: number;
    message: string;
    downloadUrl?: string;
    filename?: string;
  }
) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

function getEnhancedPath(): string {
  const homedir = require("os").homedir();
  const pythonPaths = [
    `${homedir}/Library/Python/3.9/bin`,
    `${homedir}/Library/Python/3.10/bin`,
    `${homedir}/Library/Python/3.11/bin`,
    `${homedir}/Library/Python/3.12/bin`,
    `${homedir}/.local/bin`,
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  return process.env.PATH + ":" + pythonPaths.join(":");
}

function isSpotDlAvailable(): boolean {
  try {
    execSync("which spotdl", { stdio: "ignore", env: { ...process.env, PATH: getEnhancedPath() } });
    return true;
  } catch {
    return false;
  }
}

function isYtDlpAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    execSync("which yt-dlp", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function downloadWithSpotDl(
  query: string,
  outputDir: string,
  onProgress: (progress: number, message: string) => void
): Promise<string | null> {
  return new Promise((resolve) => {
    const args = [
      query,
      "--output", outputDir,
      "--format", "mp3",
      "--threads", "1",
    ];

    // Add Python bin paths to environment
    const proc = spawn("spotdl", args, {
      env: { ...process.env, PATH: getEnhancedPath() }
    });
    let lastProgress = 0;
    let outputFile: string | null = null;

    const parseProgress = (output: string) => {
      // spotdl outputs progress like: "Downloading: 45%"
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch) {
        const progress = Math.min(parseInt(progressMatch[1]), 100);
        if (progress > lastProgress) {
          lastProgress = progress;
          const scaledProgress = 40 + (progress * 0.5);
          onProgress(scaledProgress, `Downloading... ${progress}%`);
        }
      }

      // Look for completed downloads
      if (output.includes("Downloaded")) {
        onProgress(90, "Download complete, finalizing...");
      }
    };

    proc.stdout.on("data", (data) => {
      const output = data.toString();
      parseProgress(output);
    });

    proc.stderr.on("data", (data) => {
      const output = data.toString();
      parseProgress(output);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // Find the downloaded file
        try {
          const files = readdirSync(outputDir).filter(f => f.endsWith(".mp3"));
          if (files.length > 0) {
            outputFile = join(outputDir, files[0]);
            resolve(outputFile);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    proc.on("error", () => {
      resolve(null);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 300000);
  });
}

async function searchYouTube(query: string): Promise<string | null> {
  return new Promise((resolve) => {
    const args = [
      "--default-search", "ytsearch",
      "--get-id",
      "--no-playlist",
      "-f", "bestaudio",
      query,
    ];

    const proc = spawn("yt-dlp", args);
    let videoId = "";

    proc.stdout.on("data", (data) => {
      videoId += data.toString().trim();
    });

    proc.on("close", (code) => {
      if (code === 0 && videoId) {
        resolve(videoId.split("\n")[0]);
      } else {
        resolve(null);
      }
    });

    proc.on("error", () => {
      resolve(null);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 30000);
  });
}

async function downloadWithYtDlp(
  videoId: string,
  outputPath: string,
  onProgress: (progress: number, message: string) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "-o", outputPath,
      "--no-playlist",
      "--progress",
      "--newline",
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const proc = spawn("yt-dlp", args);
    let lastProgress = 0;

    const parseProgress = (output: string) => {
      const progressMatch = output.match(/(\d+\.?\d*)%/);
      if (progressMatch) {
        const progress = Math.min(parseFloat(progressMatch[1]), 100);
        if (progress > lastProgress) {
          lastProgress = progress;
          const scaledProgress = 40 + (progress * 0.5);
          onProgress(scaledProgress, `Downloading audio... ${Math.round(progress)}%`);
        }
      }
    };

    proc.stdout.on("data", (data) => parseProgress(data.toString()));
    proc.stderr.on("data", (data) => parseProgress(data.toString()));

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 300000);
  });
}

// Fallback download method using ytdl-core (currently unused, kept for potential future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function downloadWithYtdlCore(
  query: string,
  outputPath: string,
  onProgress: (progress: number, message: string) => void
): Promise<boolean> {
  try {
    // Dynamic import to avoid issues if not installed
    const ytdl = await import("@distube/ytdl-core");
    const fs = await import("fs");

    onProgress(30, "Searching YouTube...");

    // Search for video using ytdl's search
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    // For ytdl-core, we need a direct video URL, so we'll use a simple approach
    // This requires the video ID to be found first
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await response.text();

    // Try multiple patterns to extract video ID
    let videoId = null;
    const patterns = [
      /"videoId":"([a-zA-Z0-9_-]{11})"/,
      /\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /"playabilityStatus":.*?"videoId":"([a-zA-Z0-9_-]{11})"/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      console.error("Could not find video ID in search results");
      return false;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    onProgress(40, "Found video, starting download...");

    // Download audio stream with better options
    const stream = ytdl.default(videoUrl, {
      filter: "audioonly",
      quality: "highestaudio",
      requestOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }
    });

    const writeStream = fs.createWriteStream(outputPath.replace(".mp3", ".m4a"));

    stream.on("progress", (_, downloaded, total) => {
      const percent = (downloaded / total) * 100;
      const scaledProgress = 40 + (percent * 0.5);
      onProgress(scaledProgress, `Downloading... ${Math.round(percent)}%`);
    });

    return new Promise((resolve) => {
      stream.pipe(writeStream);

      writeStream.on("finish", () => {
        resolve(true);
      });

      writeStream.on("error", (err) => {
        console.error("Write stream error:", err);
        resolve(false);
      });

      stream.on("error", (err) => {
        console.error("Download stream error:", err);
        resolve(false);
      });
    });
  } catch (error) {
    console.error("ytdl-core error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const body: DownloadRequest = await request.json();
  const { title, artist, spotifyUrl } = body;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create temp directory
        const tempDir = join(tmpdir(), "spotify-dl", randomUUID());
        if (!existsSync(tempDir)) {
          mkdirSync(tempDir, { recursive: true });
        }

        const sanitizedTitle = `${artist} - ${title}`.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 100);
        const searchQuery = spotifyUrl || `${artist} - ${title}`;

        const useSpotDl = isSpotDlAvailable();
        const useYtDlp = isYtDlpAvailable();

        if (useSpotDl) {
          // Use spotdl (BEST method - designed for Spotify)
          sendEvent(controller, {
            stage: "searching",
            progress: 20,
            message: "Finding best audio match...",
          });

          sendEvent(controller, {
            stage: "downloading",
            progress: 40,
            message: "Starting download...",
          });

          const outputPath = await downloadWithSpotDl(searchQuery, tempDir, (progress, message) => {
            sendEvent(controller, {
              stage: "downloading",
              progress,
              message,
            });
          });

          if (!outputPath || !existsSync(outputPath)) {
            sendEvent(controller, {
              stage: "error",
              progress: 0,
              message: "Failed to download audio. Please try again.",
            });
            controller.close();
            return;
          }

          sendEvent(controller, {
            stage: "converting",
            progress: 95,
            message: "Finalizing MP3 file...",
          });

          // Read the file and convert to base64 data URL
          const fileBuffer = readFileSync(outputPath);
          const base64 = fileBuffer.toString("base64");
          const dataUrl = `data:audio/mpeg;base64,${base64}`;

          // Clean up temp file and directory
          try {
            unlinkSync(outputPath);
            // Try to remove the temp directory (will only succeed if empty)
            try {
              const fs = await import("fs/promises");
              await fs.rmdir(tempDir);
            } catch {
              // Ignore if directory is not empty or other errors
            }
          } catch {
            // Ignore cleanup errors
          }

          sendEvent(controller, {
            stage: "complete",
            progress: 100,
            message: "Download complete!",
            downloadUrl: dataUrl,
            filename: `${sanitizedTitle}.mp3`,
          });
        } else if (useYtDlp) {
          // Use yt-dlp (fallback method)
          sendEvent(controller, {
            stage: "searching",
            progress: 20,
            message: "Searching for audio on YouTube (fallback)...",
          });

          let videoId = await searchYouTube(searchQuery);

          if (!videoId) {
            // Try alternative search
            const altQuery = `${title} ${artist}`;
            videoId = await searchYouTube(altQuery);

            if (!videoId) {
              sendEvent(controller, {
                stage: "error",
                progress: 0,
                message: "Could not find this song. Install spotdl for better results: pip install spotdl",
              });
              controller.close();
              return;
            }
          }

          sendEvent(controller, {
            stage: "downloading",
            progress: 40,
            message: "Found track! Starting download...",
          });

          const outputPath = join(tempDir, `${sanitizedTitle}.mp3`);

          const success = await downloadWithYtDlp(videoId, outputPath, (progress, message) => {
            sendEvent(controller, {
              stage: "downloading",
              progress,
              message,
            });
          });

          if (!success || !existsSync(outputPath)) {
            sendEvent(controller, {
              stage: "error",
              progress: 0,
              message: "Failed to download audio. Install spotdl for better results: pip install spotdl",
            });
            controller.close();
            return;
          }

          sendEvent(controller, {
            stage: "converting",
            progress: 95,
            message: "Finalizing MP3 file...",
          });

          // Read the file and convert to base64 data URL
          const fileBuffer = readFileSync(outputPath);
          const base64 = fileBuffer.toString("base64");
          const dataUrl = `data:audio/mpeg;base64,${base64}`;

          // Clean up temp file
          try {
            unlinkSync(outputPath);
            try {
              const fs = await import("fs/promises");
              await fs.rmdir(tempDir);
            } catch {
              // Ignore
            }
          } catch {
            // Ignore cleanup errors
          }

          sendEvent(controller, {
            stage: "complete",
            progress: 100,
            message: "Download complete!",
            downloadUrl: dataUrl,
            filename: `${sanitizedTitle}.mp3`,
          });
        } else {
          // Fallback to ytdl-core (last resort, least reliable)
          sendEvent(controller, {
            stage: "error",
            progress: 0,
            message: "No download tools available. Please install spotdl: pip install spotdl",
          });
          controller.close();
          return;

          /* Keeping this code for reference but disabling ytdl-core fallback
          sendEvent(controller, {
            stage: "searching",
            progress: 20,
            message: "Searching for audio (using fallback method)...",
          });

          const outputPath = join(tempDir, `${fileId}.m4a`);

          const success = await downloadWithYtdlCore(searchQuery, outputPath, (progress, message) => {
            sendEvent(controller, {
              stage: "downloading",
              progress,
              message,
            });
          });

          if (!success || !existsSync(outputPath)) {
            sendEvent(controller, {
              stage: "error",
              progress: 0,
              message: "Download failed. YouTube blocked the request. Please try again or try a different track.",
            });
            controller.close();
            return;
          }

          sendEvent(controller, {
            stage: "converting",
            progress: 95,
            message: "Finalizing audio file...",
          });

          const fileBuffer = readFileSync(outputPath);
          const base64 = fileBuffer.toString("base64");
          const dataUrl = `data:audio/mp4;base64,${base64}`;

          try {
            unlinkSync(outputPath);
          } catch {
            // Ignore cleanup errors
          }

          sendEvent(controller, {
            stage: "complete",
            progress: 100,
            message: "Download complete!",
            downloadUrl: dataUrl,
            filename: `${sanitizedTitle}.m4a`,
          });
          */
        }

        controller.close();
      } catch (error) {
        console.error("Download error:", error);
        sendEvent(controller, {
          stage: "error",
          progress: 0,
          message: error instanceof Error ? error.message : "Download failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
