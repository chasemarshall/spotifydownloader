import { NextRequest } from "next/server";
import { Innertube } from "youtubei.js";

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

async function searchAndDownloadWithYouTubeJS(
  query: string,
  onProgress: (progress: number, message: string) => void
): Promise<{ success: boolean; audioBuffer?: ArrayBuffer; error?: string }> {
  try {
    onProgress(10, "Initializing YouTube client...");

    // Initialize YouTube client
    const youtube = await Innertube.create({
      cache: new Map(),
      retrieve_player: false,
    });

    onProgress(20, "Searching YouTube...");

    // Search for the video
    const search = await youtube.search(query, { type: "video" });
    const video = search.results.find((v) => v.type === "Video");

    if (!video || video.type !== "Video") {
      return { success: false, error: "No videos found for this search" };
    }

    onProgress(40, "Found track! Getting stream info...");

    // Get video info
    const info = await youtube.getInfo(video.id);

    onProgress(50, "Selecting best audio format...");

    // Get the best audio format
    const format = info.chooseFormat({
      type: "audio",
      quality: "best",
    });

    if (!format) {
      return { success: false, error: "No audio format available" };
    }

    onProgress(60, "Downloading audio...");

    // Download the audio
    const stream = await info.download({
      type: "audio",
      quality: "best",
      format: "mp4", // Will be audio-only mp4/m4a
    });

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    let downloaded = 0;
    const totalSize = format.content_length ? parseInt(format.content_length) : 0;

    for await (const chunk of stream) {
      chunks.push(chunk);
      downloaded += chunk.length;

      if (totalSize > 0) {
        const percent = (downloaded / totalSize) * 100;
        const progress = 60 + (percent * 0.35); // 60-95%
        onProgress(progress, `Downloading... ${Math.round(percent)}%`);
      }
    }

    onProgress(95, "Processing audio file...");

    // Combine chunks into single buffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    return { success: true, audioBuffer: audioBuffer.buffer };
  } catch (error) {
    console.error("YouTube download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

export async function POST(request: NextRequest) {
  const body: DownloadRequest = await request.json();
  const { title, artist } = body;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sanitizedTitle = `${artist} - ${title}`
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .slice(0, 100);
        const searchQuery = `${artist} - ${title} audio`;

        sendEvent(controller, {
          stage: "searching",
          progress: 5,
          message: "Starting download...",
        });

        const result = await searchAndDownloadWithYouTubeJS(
          searchQuery,
          (progress, message) => {
            sendEvent(controller, {
              stage: "downloading",
              progress,
              message,
            });
          }
        );

        if (!result.success || !result.audioBuffer) {
          // Try alternative search query
          sendEvent(controller, {
            stage: "searching",
            progress: 10,
            message: "Trying alternative search...",
          });

          const altResult = await searchAndDownloadWithYouTubeJS(
            `${title} ${artist}`,
            (progress, message) => {
              sendEvent(controller, {
                stage: "downloading",
                progress,
                message,
              });
            }
          );

          if (!altResult.success || !altResult.audioBuffer) {
            sendEvent(controller, {
              stage: "error",
              progress: 0,
              message:
                altResult.error || "Could not find or download this track",
            });
            controller.close();
            return;
          }

          result.audioBuffer = altResult.audioBuffer;
        }

        sendEvent(controller, {
          stage: "converting",
          progress: 98,
          message: "Finalizing audio file...",
        });

        // Convert to base64 data URL
        const base64 = Buffer.from(result.audioBuffer).toString("base64");
        const dataUrl = `data:audio/mp4;base64,${base64}`;

        sendEvent(controller, {
          stage: "complete",
          progress: 100,
          message: "Download complete!",
          downloadUrl: dataUrl,
          filename: `${sanitizedTitle}.m4a`,
        });

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
