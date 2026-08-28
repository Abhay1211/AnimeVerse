import { NextResponse } from "next/server";
import {
    mapAniListAnime,
    type AniListAnime,
} from "../../../data/anime";

const ANILIST_API = "https://graphql.anilist.co";

/*
 * AniList's `Page.pageInfo.total` is hard-capped and does not reflect the
 * active filters (it returns 5000 for every genre). To show a real genre
 * total we probe the first N result pages in a single aliased query and add
 * up what actually comes back — exact for result sets up to N*50, otherwise
 * reported as "N*50+".
 */
const COUNT_PROBE_PAGES = 20;
const COUNT_PROBE_PER_PAGE = 50;

const countQuery = `
    query (
        $search: String
        $genre: [String]
        $format: [MediaFormat]
        $status: MediaStatus
        $season: MediaSeason
        $seasonYear: Int
    ) {
        ${Array.from(
            { length: COUNT_PROBE_PAGES },
            (_, index) => `
        p${index + 1}: Page(page: ${index + 1}, perPage: ${COUNT_PROBE_PER_PAGE}) {
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
            }
        }`
        ).join("\n")}
    }
`;

async function probeTotal(
    variables: Record<string, unknown>
): Promise<{ total: number; capped: boolean }> {
    const response = await fetch(ANILIST_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "AnimeVerse",
        },
        body: JSON.stringify({ query: countQuery, variables }),
        next: { revalidate: 3600 },
    });

    const json = await response.json();

    if (!response.ok || json.errors || !json.data) {
        return { total: 0, capped: false };
    }

    let total = 0;
    let capped = true;

    for (let page = 1; page <= COUNT_PROBE_PAGES; page++) {
        const pageLength: number =
            json.data[`p${page}`]?.media?.length ?? 0;

        total += pageLength;

        if (pageLength < COUNT_PROBE_PER_PAGE) {
            capped = false;
            break;
        }
    }

    return { total, capped };
}

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

        // The genre page asks for an accurate total separately (countOnly=1)
        // so the heavier probe never blocks the results request.
        const countOnly = searchParams.get("countOnly") === "1";

        // Accept one or many `genre` params (?genre=Action&genre=Comedy).
        const genres = searchParams
            .getAll("genre")
            .map((value) => value.trim())
            .filter(Boolean);

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

        if (genres.length) {
            variables.genre = genres;
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

        // Accurate-total request: skip the results query entirely.
        if (countOnly) {
            const { total, capped } = await probeTotal(variables);

            return NextResponse.json({
                pagination: {
                    total,
                    totalIsCapped: capped,
                },
            });
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