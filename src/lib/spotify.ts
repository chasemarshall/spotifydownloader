interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  external_urls: { spotify: string };
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string; width: number; height: number }[];
  tracks: {
    total: number;
    items: {
      track: SpotifyTrack;
    }[];
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to authenticate with Spotify");
  }

  const data: SpotifyTokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export function extractTrackId(url: string): string | null {
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export async function getTrackInfo(trackId: string): Promise<{
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number;
  spotifyUrl: string;
}> {
  const token = await getSpotifyToken();

  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Track not found");
    }
    throw new Error("Failed to fetch track info from Spotify");
  }

  const track: SpotifyTrack = await response.json();

  return {
    id: track.id,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArt: track.album.images[0]?.url || "",
    duration: track.duration_ms,
    spotifyUrl: track.external_urls.spotify,
  };
}

export async function getPlaylistInfo(playlistId: string): Promise<{
  id: string;
  name: string;
  description: string;
  coverArt: string;
  totalTracks: number;
  tracks: {
    id: string;
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    duration: number;
    spotifyUrl: string;
  }[];
}> {
  const token = await getSpotifyToken();

  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Playlist not found");
    }
    throw new Error("Failed to fetch playlist info from Spotify");
  }

  const playlist: SpotifyPlaylist = await response.json();

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    coverArt: playlist.images[0]?.url || "",
    totalTracks: playlist.tracks.total,
    tracks: playlist.tracks.items.map((item) => ({
      id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((a) => a.name).join(", "),
      album: item.track.album.name,
      albumArt: item.track.album.images[0]?.url || "",
      duration: item.track.duration_ms,
      spotifyUrl: item.track.external_urls.spotify,
    })),
  };
}
