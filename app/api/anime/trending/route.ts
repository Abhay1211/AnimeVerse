import { NextResponse } from "next/server";

const ANILIST_API = "https://graphql.anilist.co";

const query = `
    query {
        Page(page: 1, perPage: 7) {
            media(
                type: ANIME
                sort: TRENDING_DESC
                isAdult: false
            ) {
                id

                title {
                    english
                    romaji
                }

                description

                coverImage {
                    large
                    extraLarge
                }

                bannerImage

                genres
            }
        }
    }
`;

export async function GET() {
    try {
        const response = await fetch(ANILIST_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ query }),

            // Refresh trending data every 5 minutes.
            next: {
                revalidate: 300,
            },
        });

        if (!response.ok) {
            throw new Error(`AniList returned ${response.status}`);
        }

        const json = await response.json();

        if (json.errors) {
            throw new Error("AniList returned GraphQL errors");
        }

        const media = json?.data?.Page?.media;

        if (!Array.isArray(media)) {
            throw new Error("Invalid AniList response");
        }

        const anime = media.map((item: any) => ({
            id: item.id,
            title:
                item.title?.english ||
                item.title?.romaji ||
                "Unknown Anime",

            description:
                item.description
                    ?.replace(/<[^>]*>/g, "")
                    .replace(/\s+/g, " ")
                    .trim() || "",

            poster:
                item.coverImage?.extraLarge ||
                item.coverImage?.large ||
                "",

            banner:
                item.bannerImage ||
                item.coverImage?.extraLarge ||
                item.coverImage?.large ||
                "",

            genres: item.genres || [],
        }));

        return NextResponse.json(anime);
    } catch (error) {
        console.error("Trending anime error:", error);

        return NextResponse.json(
            { error: "Failed to load trending anime." },
            { status: 500 }
        );
    }
}