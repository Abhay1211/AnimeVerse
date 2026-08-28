import { NextResponse } from "next/server";
import {
    countFranchiseSeasons,
    mapAniListAnime,
    type AniListAnime,
} from "../../../data/anime";
import { getTmdbArtwork } from "../../../lib/tmdb";

const ANILIST_API = "https://graphql.anilist.co";

/* ------------------------------------------------------------------
   FRANCHISE SEASON CHAIN
   AniList `relations` only exposes DIRECTLY adjacent entries, so a
   mid-chain season (e.g. Mushoku Tensei S3) can't see S1 from a single
   response. We walk the prequel/sequel graph (TV / TV_SHORT only) in a
   few batched, day-cached requests to get the full chain, then count
   distinct seasons from it (split cours fold together).
   ------------------------------------------------------------------ */

const TV_CHAIN_FORMATS = new Set(["TV", "TV_SHORT"]);
const CHAIN_RELATIONS = new Set(["PREQUEL", "SEQUEL"]);

const chainQuery = `
    query ($ids: [Int]) {
        Page(perPage: 50) {
            media(id_in: $ids, type: ANIME) {
                id
                format
                seasonYear
                title {
                    romaji
                    english
                }
                relations {
                    edges {
                        relationType
                        node {
                            id
                            format
                        }
                    }
                }
            }
        }
    }
`;

type ChainMedia = {
    id: number;
    format: string | null;
    seasonYear: number | null;
    title: { romaji: string | null; english: string | null };
    relations: {
        edges: {
            relationType: string;
            node: { id: number; format: string | null };
        }[];
    };
};

async function walkFranchiseChain(
    rootId: number
): Promise<{ title: string; seasonYear: number | null }[]> {
    const known = new Map<number, ChainMedia>();
    let frontier: number[] = [rootId];
    let batches = 0;

    while (
        frontier.length > 0 &&
        known.size < 14 &&
        batches < 6
    ) {
        batches += 1;

        const ids = frontier.filter((id) => !known.has(id));
        if (ids.length === 0) break;

        const response = await fetch(ANILIST_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "AnimeVerse",
            },
            body: JSON.stringify({
                query: chainQuery,
                variables: { ids },
            }),
            next: { revalidate: 86400 },
        });

        const json = await response.json();
        const media: ChainMedia[] =
            json?.data?.Page?.media ?? [];

        const nextFrontier: number[] = [];

        for (const item of media) {
            known.set(item.id, item);

            for (const edge of item.relations.edges) {
                if (
                    CHAIN_RELATIONS.has(edge.relationType) &&
                    TV_CHAIN_FORMATS.has(
                        (edge.node.format || "").toUpperCase()
                    ) &&
                    !known.has(edge.node.id)
                ) {
                    nextFrontier.push(edge.node.id);
                }
            }
        }

        frontier = nextFrontier;
    }

    return [...known.values()]
        .filter((item) =>
            TV_CHAIN_FORMATS.has(
                (item.format || "").toUpperCase()
            )
        )
        .sort(
            (a, b) =>
                (a.seasonYear ?? 0) - (b.seasonYear ?? 0)
        )
        .map((item) => ({
            title:
                item.title.english ||
                item.title.romaji ||
                "",
            seasonYear: item.seasonYear,
        }));
}

const query = `
    query ($id: Int) {
        Media(id: $id, type: ANIME) {
            id

            title {
                romaji
                english
                native
            }

            description

            startDate {
                year
                month
                day
            }

            endDate {
                year
                month
                day
            }

            episodes
            format
            status
            duration
            averageScore
            popularity
            genres

            season
            seasonYear

            coverImage {
                large
            }

            bannerImage

            studios {
                nodes {
                    name
                }
            }

            nextAiringEpisode {
                episode
                airingAt
                timeUntilAiring
            }

            streamingEpisodes {
                title
                thumbnail
            }

            relations {
                edges {
                    relationType

                    node {
                        id

                        title {
                            romaji
                            english
                            native
                        }

                        coverImage {
                            large
                        }

                        bannerImage
                        format
                        status
                        type
                        episodes
                        season
                        seasonYear
                        averageScore
                    }
                }
            }

            recommendations(
                sort: RATING_DESC
                perPage: 6
            ) {
                nodes {
                    mediaRecommendation {
                        id

                        title {
                            romaji
                            english
                        }

                        format

                        coverImage {
                            large
                        }
                    }
                }
            }
        }
    }
`;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const animeId = Number(id);

        if (!Number.isInteger(animeId)) {
            return NextResponse.json(
                { error: "Invalid anime ID" },
                { status: 400 }
            );
        }

        const response = await fetch(ANILIST_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                variables: {
                    id: animeId,
                },
            }),
            next: {
                revalidate: 3600,
            },
        });

        const result = await response.json();

        if (!response.ok || result.errors) {
            console.error(
                "AniList GraphQL errors:",
                result.errors
            );

            return NextResponse.json(
                {
                    error:
                        result.errors?.[0]?.message ||
                        "AniList request failed",
                },
                { status: 500 }
            );
        }

        if (!result.data?.Media) {
            return NextResponse.json(
                { error: "Anime not found" },
                { status: 404 }
            );
        }

        const anime: AniListAnime = result.data.Media;

        const mappedAnime = mapAniListAnime(anime);

        // TMDB supplies the wide cinematic backdrop + the stylised text logo,
        // which AniList doesn't have. The poster stays AniList `coverImage`
        // so the detail page matches every anime card.
        try {
            const artwork = await getTmdbArtwork(
                mappedAnime.title,
                mappedAnime.year
            );

            if (artwork) {
                mappedAnime.banner =
                    artwork.banner ?? mappedAnime.banner;

                mappedAnime.logo = artwork.logo ?? null;
            }
        } catch (error) {
            console.error("TMDB artwork error:", error);
        }

        // Real franchise season count from the walked prequel/sequel chain.
        try {
            const chain = await walkFranchiseChain(animeId);
            mappedAnime.totalSeasons =
                countFranchiseSeasons(chain);
        } catch (error) {
            console.error("Season chain walk error:", error);
        }

        return NextResponse.json(mappedAnime);
    } catch (error) {
        console.error("AniList anime detail error:", error);

        return NextResponse.json(
            { error: "Failed to fetch anime" },
            { status: 500 }
        );
    }
}