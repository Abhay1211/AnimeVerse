import { NextResponse } from "next/server";
import {
    mapAniListAnime,
    type AniListAnime,
} from "../../../data/anime";
import { getTmdbArtwork } from "../../../lib/tmdb";

const ANILIST_API = "https://graphql.anilist.co";

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

        try {
            const artwork = await getTmdbArtwork(
                mappedAnime.title,
                mappedAnime.year
            );

            if (artwork) {
                mappedAnime.poster =
                    artwork.poster ?? mappedAnime.poster;

                mappedAnime.banner =
                    artwork.banner ?? mappedAnime.banner;

                mappedAnime.logo =
                    artwork.logo ?? null;
            }
        } catch (error) {
            console.error("TMDB artwork error:", error);
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