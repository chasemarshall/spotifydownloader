import { NextRequest } from "next/server";
import { spawn, execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

interface DownloadRequest {
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number;
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

function isYtDlpAvailable(): boolean {
  try {
    execSync("which yt-dlp", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await response.text();

    // Extract first video ID from search results
    const videoIdMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) {
      return false;
    }

    const videoId = videoIdMatch[1];
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    onProgress(40, "Found video, starting download...");

    // Download audio stream
    const stream = ytdl.default(videoUrl, {
      filter: "audioonly",
      quality: "highestaudio",
    });

    const writeStream = fs.createWriteStream(outputPath.replace(".mp3", ".m4a"));

    let downloadedBytes = 0;

    stream.on("progress", (_, downloaded, total) => {
      downloadedBytes = downloaded;
      const percent = (downloaded / total) * 100;
      const scaledProgress = 40 + (percent * 0.5);
      onProgress(scaledProgress, `Downloading... ${Math.round(percent)}%`);
    });

    return new Promise((resolve) => {
      stream.pipe(writeStream);

      writeStream.on("finish", () => {
        resolve(true);
      });

      writeStream.on("error", () => {
        resolve(false);
      });

      stream.on("error", () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const body: DownloadRequest = await request.json();
  const { title, artist } = body;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create temp directory
        const tempDir = join(tmpdir(), "spotify-dl");
        if (!existsSync(tempDir)) {
          mkdirSync(tempDir, { recursive: true });
        }

        const fileId = randomUUID();
        const sanitizedTitle = `${artist} - ${title}`.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 100);
        const searchQuery = `${artist} - ${title} audio`;

        const useYtDlp = isYtDlpAvailable();

        if (useYtDlp) {
          // Use yt-dlp (preferred method)
          sendEvent(controller, {
            stage: "searching",
            progress: 20,
            message: "Searching for audio on YouTube...",
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
                message: "Could not find this song on YouTube. Try a different track.",
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

          const outputPath = join(tempDir, `${fileId}.mp3`);

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

          // Clean up temp file
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
            filename: `${sanitizedTitle}.mp3`,
          });
        } else {
          // Fallback to ytdl-core (serverless compatible but less reliable)
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
              message: "Download failed. For best results, install yt-dlp locally.",
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
