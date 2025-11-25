import { NextRequest, NextResponse } from "next/server";
import { extractPlaylistId, getPlaylistInfo } from "@/lib/spotify";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "Spotify URL is required" },
        { status: 400 }
      );
    }

    const playlistId = extractPlaylistId(url);

    if (!playlistId) {
      return NextResponse.json(
        { error: "Invalid Spotify playlist URL" },
        { status: 400 }
      );
    }

    const playlistInfo = await getPlaylistInfo(playlistId);

    return NextResponse.json(playlistInfo);
  } catch (error) {
    console.error("Playlist info error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch playlist info" },
      { status: 500 }
    );
  }
}
