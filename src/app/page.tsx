"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music,
  Download,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Music2,
} from "lucide-react";
import Image from "next/image";

interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number;
  spotifyUrl: string;
}

interface DownloadStatus {
  stage: "idle" | "fetching" | "searching" | "downloading" | "converting" | "complete" | "error";
  progress: number;
  message: string;
  downloadUrl?: string;
  filename?: string;
}

export default function Home() {
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [status, setStatus] = useState<DownloadStatus>({
    stage: "idle",
    progress: 0,
    message: "",
  });

  const isValidSpotifyUrl = (url: string) => {
    return /^https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/.test(url);
  };

  const fetchTrackInfo = useCallback(async () => {
    if (!spotifyUrl) return;

    if (!isValidSpotifyUrl(spotifyUrl)) {
      setStatus({
        stage: "error",
        progress: 0,
        message: "Please enter a valid Spotify track URL",
      });
      return;
    }

    setStatus({
      stage: "fetching",
      progress: 10,
      message: "Fetching track information...",
    });
    setTrackInfo(null);

    try {
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: spotifyUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch track info");
      }

      setTrackInfo(data);
      setStatus({
        stage: "idle",
        progress: 0,
        message: "",
      });
    } catch (error) {
      setStatus({
        stage: "error",
        progress: 0,
        message: error instanceof Error ? error.message : "Failed to fetch track info",
      });
    }
  }, [spotifyUrl]);

  const startDownload = useCallback(async () => {
    if (!trackInfo) return;

    setStatus({
      stage: "searching",
      progress: 20,
      message: "Searching for audio source...",
    });

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trackInfo.title,
          artist: trackInfo.artist,
          album: trackInfo.album,
          albumArt: trackInfo.albumArt,
          duration: trackInfo.duration,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Failed to start download stream");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.stage === "error") {
              throw new Error(data.message);
            }

            setStatus({
              stage: data.stage,
              progress: data.progress,
              message: data.message,
              downloadUrl: data.downloadUrl,
              filename: data.filename,
            });
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (error) {
      setStatus({
        stage: "error",
        progress: 0,
        message: error instanceof Error ? error.message : "Download failed",
      });
    }
  }, [trackInfo]);

  const resetState = () => {
    setSpotifyUrl("");
    setTrackInfo(null);
    setStatus({ stage: "idle", progress: 0, message: "" });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getStageIcon = () => {
    switch (status.stage) {
      case "fetching":
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case "searching":
        return <Music2 className="w-5 h-5 animate-pulse" />;
      case "downloading":
      case "converting":
        return <Download className="w-5 h-5 animate-bounce" />;
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-spotify-green" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen animated-bg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-spotify-green/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 min-h-screen flex flex-col items-center justify-center">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Music className="w-12 h-12 text-spotify-green" />
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-bold text-gradient">
              Spotifydown
            </h1>
          </div>
          <p className="text-spotify-light text-lg max-w-md mx-auto">
            Convert your favorite Spotify tracks to MP3 in seconds
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-xl"
        >
          <div className="glass rounded-3xl p-8 glow">
            {/* URL Input */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Sparkles className="w-5 h-5 text-spotify-green" />
              </div>
              <input
                type="text"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTrackInfo()}
                placeholder="Paste Spotify track URL here..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-spotify-light/50 focus:border-spotify-green/50 focus:bg-white/10 transition-all duration-300"
                disabled={status.stage !== "idle" && status.stage !== "error"}
              />
            </div>

            {/* Fetch Button */}
            {!trackInfo && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchTrackInfo}
                disabled={!spotifyUrl || (status.stage !== "idle" && status.stage !== "error")}
                className="w-full btn-shine bg-gradient-to-r from-spotify-green to-emerald-500 text-white font-semibold py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
              >
                {status.stage === "fetching" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Music className="w-5 h-5" />
                    Get Track Info
                  </>
                )}
              </motion.button>
            )}

            {/* Error Display */}
            <AnimatePresence>
              {status.stage === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{status.message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Track Info Card */}
            <AnimatePresence>
              {trackInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-6"
                >
                  <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <Image
                        src={trackInfo.albumArt}
                        alt={trackInfo.album}
                        fill
                        className="object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/20 rounded-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-lg truncate">
                        {trackInfo.title}
                      </h3>
                      <p className="text-spotify-light truncate">{trackInfo.artist}</p>
                      <p className="text-spotify-light/60 text-sm truncate">
                        {trackInfo.album}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-spotify-light/60 text-xs">
                          {formatDuration(trackInfo.duration)}
                        </span>
                        <a
                          href={trackInfo.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-spotify-green text-xs flex items-center gap-1 hover:underline"
                        >
                          Open in Spotify
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Progress Section */}
                  {status.stage !== "idle" && status.stage !== "error" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4"
                    >
                      {/* Progress Bar */}
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${status.progress}%` }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-gradient-to-r from-spotify-green to-emerald-400 rounded-full"
                        />
                      </div>

                      {/* Status Message */}
                      <div className="flex items-center gap-2 text-sm text-spotify-light">
                        {getStageIcon()}
                        <span>{status.message}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-3">
                    {status.stage === "idle" && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={startDownload}
                        className="flex-1 btn-shine bg-gradient-to-r from-spotify-green to-emerald-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download MP3
                      </motion.button>
                    )}

                    {status.stage === "complete" && status.downloadUrl && (
                      <motion.a
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        href={status.downloadUrl}
                        download={status.filename}
                        className="flex-1 btn-shine bg-gradient-to-r from-spotify-green to-emerald-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Save File
                      </motion.a>
                    )}

                    {(status.stage === "idle" || status.stage === "complete" || status.stage === "error") && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={resetState}
                        className="px-6 py-3 border border-white/20 text-white rounded-xl hover:bg-white/10 transition-colors"
                      >
                        New
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-spotify-light/40 text-sm">
            For educational purposes only. Audio sourced from YouTube.
          </p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-spotify-green/60 rounded-full music-bar"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </motion.footer>
      </div>
    </main>
  );
}
