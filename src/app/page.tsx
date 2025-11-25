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

interface PlaylistInfo {
  id: string;
  name: string;
  description: string;
  coverArt: string;
  totalTracks: number;
  tracks: TrackInfo[];
}

interface DownloadStatus {
  stage: "idle" | "fetching" | "searching" | "downloading" | "converting" | "complete" | "error";
  progress: number;
  message: string;
  downloadUrl?: string;
  filename?: string;
  trackId?: string;
}

export default function Home() {
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [status, setStatus] = useState<DownloadStatus>({
    stage: "idle",
    progress: 0,
    message: "",
  });

  const isValidSpotifyUrl = (url: string) => {
    return /^https?:\/\/open\.spotify\.com\/(track|playlist)\/[a-zA-Z0-9]+/.test(url);
  };

  const isPlaylistUrl = (url: string) => {
    return url.includes("/playlist/");
  };

  const fetchTrackInfo = useCallback(async () => {
    if (!spotifyUrl) return;

    if (!isValidSpotifyUrl(spotifyUrl)) {
      setStatus({
        stage: "error",
        progress: 0,
        message: "Please enter a valid Spotify track or playlist URL",
      });
      return;
    }

    const isPlaylist = isPlaylistUrl(spotifyUrl);

    setStatus({
      stage: "fetching",
      progress: 10,
      message: isPlaylist ? "Fetching playlist information..." : "Fetching track information...",
    });
    setTrackInfo(null);
    setPlaylistInfo(null);

    try {
      const endpoint = isPlaylist ? "/api/playlist" : "/api/track";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: spotifyUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch ${isPlaylist ? "playlist" : "track"} info`);
      }

      if (isPlaylist) {
        setPlaylistInfo(data);
      } else {
        setTrackInfo(data);
      }

      setStatus({
        stage: "idle",
        progress: 0,
        message: "",
      });
    } catch (error) {
      setStatus({
        stage: "error",
        progress: 0,
        message: error instanceof Error ? error.message : "Failed to fetch info",
      });
    }
  }, [spotifyUrl]);

  const startDownload = useCallback(async (track: TrackInfo) => {
    if (!track) return;

    setStatus({
      stage: "searching",
      progress: 20,
      message: "Searching for audio source...",
      trackId: track.id,
    });

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          album: track.album,
          albumArt: track.albumArt,
          duration: track.duration,
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

            setStatus((prev) => ({
              stage: data.stage,
              progress: data.progress,
              message: data.message,
              downloadUrl: data.downloadUrl,
              filename: data.filename,
              trackId: prev.trackId,
            }));
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
  }, []);

  const resetState = () => {
    setSpotifyUrl("");
    setTrackInfo(null);
    setPlaylistInfo(null);
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
        return <Download className="w-5 h-5" />;
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-accent" />;
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
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />
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
              <Music className="w-12 h-12 text-accent" />
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-bold font-[family-name:var(--font-typewriter)] text-gradient">
              sonata.
            </h1>
          </div>
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
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <input
                type="text"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTrackInfo()}
                placeholder="paste spotify track url here..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-spotify-light/50 focus:border-accent/50 focus:bg-white/10 transition-all duration-300"
                disabled={status.stage !== "idle" && status.stage !== "error"}
              />
            </div>

            {/* Fetch Button */}
            {!trackInfo && !playlistInfo && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchTrackInfo}
                disabled={!spotifyUrl || (status.stage !== "idle" && status.stage !== "error")}
                className="w-full btn-shine bg-gradient-to-r from-accent to-purple-500 text-white font-semibold py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
              >
                {status.stage === "fetching" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    fetching...
                  </>
                ) : (
                  <>
                    <Music className="w-5 h-5" />
                    get info
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
                          className="text-accent text-xs flex items-center gap-1 hover:underline"
                        >
                          open in spotify
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
                          className="h-full bg-gradient-to-r from-accent to-purple-400 rounded-full"
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
                        onClick={() => startDownload(trackInfo)}
                        className="flex-1 btn-shine bg-gradient-to-r from-accent to-purple-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        download mp3
                      </motion.button>
                    )}

                    {status.stage === "complete" && status.downloadUrl && (
                      <motion.a
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        href={status.downloadUrl}
                        download={status.filename}
                        className="flex-1 btn-shine bg-gradient-to-r from-accent to-purple-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        save file
                      </motion.a>
                    )}

                    {(status.stage === "idle" || status.stage === "complete" || status.stage === "error") && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={resetState}
                        className="px-6 py-3 border border-white/20 text-white rounded-xl hover:bg-white/10 transition-colors"
                      >
                        new
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Playlist Info Card */}
              {playlistInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-6"
                >
                  {/* Playlist Header */}
                  <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 mb-4">
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <Image
                        src={playlistInfo.coverArt}
                        alt={playlistInfo.name}
                        fill
                        className="object-cover rounded-xl"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-lg truncate">
                        {playlistInfo.name}
                      </h3>
                      <p className="text-spotify-light text-sm truncate">
                        {playlistInfo.totalTracks} tracks
                      </p>
                      {playlistInfo.description && (
                        <p className="text-spotify-light/60 text-xs mt-1 line-clamp-2">
                          {playlistInfo.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Playlist Tracks */}
                  <div className="relative">
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-3 pb-12 playlist-scroll">
                      {playlistInfo.tracks.map((track, index) => (
                        <motion.div
                          key={track.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <Image
                              src={track.albumArt}
                              alt={track.album}
                              fill
                              className="object-cover rounded-lg"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {track.title}
                            </p>
                            <p className="text-spotify-light text-xs truncate">
                              {track.artist}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-spotify-light/60 text-xs">
                              {formatDuration(track.duration)}
                            </span>
                            {status.trackId === track.id && status.stage !== "idle" && status.stage !== "complete" && status.stage !== "error" ? (
                              <div className="w-8 h-8 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                              </div>
                            ) : status.trackId === track.id && status.stage === "complete" && status.downloadUrl ? (
                              <motion.a
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                href={status.downloadUrl}
                                download={status.filename}
                                className="w-8 h-8 flex items-center justify-center bg-accent/20 rounded-lg hover:bg-accent/30 transition-colors"
                              >
                                <CheckCircle2 className="w-4 h-4 text-accent" />
                              </motion.a>
                            ) : (
                              <button
                                onClick={() => startDownload(track)}
                                disabled={status.stage !== "idle" && status.stage !== "complete" && status.stage !== "error"}
                                className="w-8 h-8 flex items-center justify-center bg-accent/20 rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Download className="w-4 h-4 text-accent" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {/* Fade gradient at bottom */}
                    <div className="absolute bottom-0 left-0 right-3 h-16 bg-gradient-to-t from-[#0d0d0d] to-transparent pointer-events-none" />
                  </div>

                  {/* New Button */}
                  <div className="mt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={resetState}
                      className="w-full px-6 py-3 border border-white/20 text-white rounded-xl hover:bg-white/10 transition-colors lowercase"
                    >
                      new
                    </motion.button>
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
          className="mt-12 text-center space-y-3"
        >
          <a
            href="https://ko-fi.com/chasemarsh"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-0 hover:gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-accent/50 transition-all duration-300 text-sm text-white"
          >
            <span>☕</span>
            <span className="max-w-0 overflow-hidden group-hover:max-w-[150px] transition-all duration-300 whitespace-nowrap">buy me a coffee</span>
          </a>
          <div className="flex items-center justify-center gap-1">
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-accent/60 rounded-full music-bar"
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
