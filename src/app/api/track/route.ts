import { NextRequest, NextResponse } from "next/server";
import { extractTrackId, getTrackInfo } from "@/lib/spotify";

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

    const trackId = extractTrackId(url);

    if (!trackId) {
      return NextResponse.json(
        { error: "Invalid Spotify track URL" },
        { status: 400 }
      );
    }

    const trackInfo = await getTrackInfo(trackId);

    return NextResponse.json(trackInfo);
  } catch (error) {
    console.error("Track info error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch track info" },
      { status: 500 }
    );
  }
}
