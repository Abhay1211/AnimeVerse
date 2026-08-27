import { NextResponse } from "next/server";
import {
    mapAniListAnime,
    type AniListAnime,
} from "../../../data/anime";

const ANILIST_API = "https://graphql.anilist.co";

const query = `
    query (
        $page: Int
        $perPage: Int
        $search: String
        $genre: [String]
        $format: [MediaFormat]
        $status: MediaStatus
        $season: MediaSeason
        $seasonYear: Int
    ) {
        Page(
            page: $page
            perPage: $perPage
        ) {
            pageInfo {
                currentPage
                lastPage
                hasNextPage
                total
            }

            media(
                type: ANIME
                search: $search
                genre_in: $genre
                format_in: $format
                status: $status
                season: $season
                seasonYear: $seasonYear
                sort: POPULARITY_DESC
            ) {
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
            }
        }
    }
`;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const page = Math.max(
            1,
            Number(searchParams.get("page") || "1")
        );

        const perPage = Math.min(
            50,
            Math.max(
                1,
                Number(searchParams.get("perPage") || "24")
            )
        );

        const search = searchParams.get("search")?.trim();
        const genre = searchParams.get("genre")?.trim();
        const format = searchParams.get("format")?.trim();
        const status = searchParams.get("status")?.trim();
        const season = searchParams.get("season")?.trim();

        const seasonYearValue =
            searchParams.get("seasonYear");

        const seasonYear = seasonYearValue
            ? Number(seasonYearValue)
            : undefined;

        if (
            seasonYear !== undefined &&
            (!Number.isInteger(seasonYear) ||
                seasonYear < 1900 ||
                seasonYear > 2100)
        ) {
            return NextResponse.json(
                { error: "Invalid season year" },
                { status: 400 }
            );
        }

        const variables: Record<string, unknown> = {
            page,
            perPage,
        };

        if (search) {
            variables.search = search;
        }

        if (genre) {
            variables.genre = [genre];
        }

        if (format) {
            variables.format = [format];
        }

        if (status) {
            variables.status = status;
        }

        if (season) {
            variables.season = season;
        }

        if (seasonYear !== undefined) {
            variables.seasonYear = seasonYear;
        }

        const response = await fetch(ANILIST_API, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                query,
                variables,
            }),

            cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || result.errors) {
            console.error(
                "AniList browse errors:",
                result.errors
            );

            return NextResponse.json(
                {
                    error:
                        result.errors?.[0]?.message ||
                        "AniList browse request failed",
                },
                { status: 500 }
            );
        }

        const pageData = result.data?.Page;

        if (!pageData) {
            return NextResponse.json(
                { error: "No browse data returned" },
                { status: 500 }
            );
        }

        const anime = (
            pageData.media as AniListAnime[]
        ).map(mapAniListAnime);

        return NextResponse.json({
            anime,

            pagination: {
                currentPage:
                    pageData.pageInfo.currentPage,

                lastPage:
                    pageData.pageInfo.lastPage,

                hasNextPage:
                    pageData.pageInfo.hasNextPage,

                total:
                    pageData.pageInfo.total,
            },
        });
    } catch (error) {
        console.error(
            "AniList browse API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch anime",
            },
            { status: 500 }
        );
    }
}