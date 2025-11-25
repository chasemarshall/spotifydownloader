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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

async function downloadWithPlayDl(
  query: string,
  outputPath: string,
  onProgress: (progress: number, message: string) => void
): Promise<boolean> {
  try {
    const play = await import("play-dl");
    const fs = await import("fs");

    onProgress(30, "Searching YouTube...");

    // Search YouTube
    const searchResults = await play.search(query, {
      limit: 1,
      source: { youtube: "video" }
    });

    if (!searchResults || searchResults.length === 0) {
      return false;
    }

    const video = searchResults[0];
    onProgress(40, "Found track! Starting download...");

    // Get stream info
    const stream = await play.stream(video.url);

    const writeStream = fs.createWriteStream(outputPath);
    stream.stream.pipe(writeStream);

    let lastProgress = 40;

    // Monitor progress
    const progressInterval = setInterval(() => {
      if (lastProgress < 90) {
        lastProgress += 5;
        onProgress(lastProgress, `Downloading... ${Math.round(lastProgress - 40)}%`);
      }
    }, 1000);

    return new Promise((resolve) => {
      writeStream.on("finish", () => {
        clearInterval(progressInterval);
        stream.stream.destroy();
        resolve(true);
      });

      writeStream.on("error", (err) => {
        clearInterval(progressInterval);
        console.error("Write stream error:", err);
        stream.stream.destroy();
        resolve(false);
      });

      stream.stream.on("error", (err) => {
        clearInterval(progressInterval);
        console.error("Download stream error:", err);
        resolve(false);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(progressInterval);
        stream.stream.destroy();
        writeStream.destroy();
        resolve(false);
      }, 120000);
    });
  } catch (error) {
    console.error("play-dl error:", error);
    return false;
  }
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

    // Search for video using YouTube search
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    // For ytdl-core, we need a direct video URL, so we'll use a simple approach
    // This requires the video ID to be found first
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      }
    });

    if (!response.ok) {
      throw new Error("YouTube search failed");
    }

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

    // Create agent with cookies to avoid blocking
    const agent = ytdl.createAgent(undefined, {
      localAddress: undefined,
    });

    // Download audio stream with better options
    const stream = ytdl.default(videoUrl, {
      filter: "audioonly",
      quality: "highestaudio",
      agent,
      requestOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
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

      // Timeout after 2 minutes
      setTimeout(() => {
        stream.destroy();
        writeStream.destroy();
        resolve(false);
      }, 120000);
    });
  } catch (error) {
    console.error("Download error:", error);
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
          // Fallback methods for serverless environments
          sendEvent(controller, {
            stage: "searching",
            progress: 20,
            message: "Searching for audio...",
          });

          let outputPath = join(tempDir, `${fileId}.webm`);
          let success = false;
          let fileFormat = "webm";

          // Try play-dl first (more reliable in serverless)
          try {
            success = await downloadWithPlayDl(searchQuery, outputPath, (progress, message) => {
              sendEvent(controller, {
                stage: "downloading",
                progress,
                message,
              });
            });
          } catch (error) {
            console.error("play-dl failed, trying ytdl-core:", error);
          }

          // If play-dl failed, try ytdl-core
          if (!success || !existsSync(outputPath)) {
            outputPath = join(tempDir, `${fileId}.m4a`);
            fileFormat = "m4a";

            success = await downloadWithYtdlCore(searchQuery, outputPath, (progress, message) => {
              sendEvent(controller, {
                stage: "downloading",
                progress,
                message,
              });
            });
          }

          if (!success || !existsSync(outputPath)) {
            sendEvent(controller, {
              stage: "error",
              progress: 0,
              message: "Download failed. For best results, install yt-dlp locally or try a different track.",
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
          const mimeType = fileFormat === "webm" ? "audio/webm" : "audio/mp4";
          const dataUrl = `data:${mimeType};base64,${base64}`;

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
            filename: `${sanitizedTitle}.${fileFormat}`,
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
