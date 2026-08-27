import { NextResponse } from "next/server";
import {
    mapAniListAnime,
    type AniListAnime,
} from "../../../data/anime";

const ANILIST_API = "https://graphql.anilist.co";
const VALID_SORTS = [
    "TRENDING_DESC",
    "POPULARITY_DESC",
    "FAVOURITES_DESC",
    "SCORE_DESC",
    "START_DATE_DESC",
] as const;

type AnimeSort = (typeof VALID_SORTS)[number];

const query = (
    sort: AnimeSort,
    status?: "RELEASING" | "NOT_YET_RELEASED",
    excludeUpcoming = false
) => `
    query {
        Page(page: 1, perPage: 20) {
            media(
                type: ANIME
                sort: ${sort}
                ${status ? `status: ${status}` : ""}
                ${excludeUpcoming ? "status_not: NOT_YET_RELEASED" : ""}
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
                }

                episodes
                format
                averageScore
                genres

                coverImage {
                    large
                }

                bannerImage
            }
        }
    }
`;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const sortParam =
            searchParams.get("sort") || "TRENDING_DESC";

        const sort: AnimeSort = VALID_SORTS.includes(
            sortParam as AnimeSort
        )
            ? (sortParam as AnimeSort)
            : "TRENDING_DESC";

        const statusParam = searchParams.get("status");

        const status =
            statusParam === "RELEASING" ||
                statusParam === "NOT_YET_RELEASED"
                ? statusParam
                : undefined;

        const excludeUpcoming =
            searchParams.get("excludeUpcoming") === "true";

        const response = await fetch(ANILIST_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: query(
                    sort,
                    status,
                    excludeUpcoming
                ),
            }),
            next: {
                revalidate: 3600,
            },
        });

        if (!response.ok) {
            throw new Error("AniList request failed");
        }

        const result = await response.json();

        if (result.errors) {
            console.error("AniList GraphQL errors:", result.errors);
            throw new Error("AniList GraphQL request failed");
        }

        const anime: AniListAnime[] =
            result.data.Page.media;

        return NextResponse.json(
            anime.map(mapAniListAnime)
        );
    } catch (error) {
        console.error("AniList API error:", error);

        return NextResponse.json(
            { error: "Failed to fetch anime" },
            { status: 500 }
        );
    }
}