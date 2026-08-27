import { NextResponse } from "next/server";
import { getTmdbEpisodeImages } from "../../../../lib/tmdb";

/**
 * Per-episode images/titles for the watch page, sourced from TMDB stills
 * (real frames from each episode). Kept as its own route so the heavier
 * TMDB season/episode-group lookups don't slow the anime-detail response.
 *
 * GET /api/anime/{id}/episodes?title=<anime title>&year=<start year>
 *   → { episodes: [{ number, title, thumbnail }] }   (absolute episode order)
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await params;

        const { searchParams } = new URL(request.url);
        const title = searchParams.get("title")?.trim();
        const yearValue = searchParams.get("year");
        const year = yearValue ? Number(yearValue) : null;

        if (!title) {
            return NextResponse.json({ episodes: [] });
        }

        const episodes = await getTmdbEpisodeImages(
            title,
            Number.isInteger(year) ? year : null
        );

        return NextResponse.json(
            { episodes },
            {
                headers: {
                    "Cache-Control":
                        "public, s-maxage=86400, stale-while-revalidate=604800",
                },
            }
        );
    } catch (error) {
        console.error("Anime episodes API error:", error);
        return NextResponse.json({ episodes: [] });
    }
}
