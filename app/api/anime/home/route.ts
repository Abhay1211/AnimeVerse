import { NextResponse } from "next/server";
import {
    mapAniListAnime,
    type AniListAnime,
} from "../../../data/anime";
import { getTmdbArtwork } from "../../../lib/tmdb";
import { providers } from "../../../lib/providers";

type AiringSchedule = {
    episode: number;
    airingAt: number;
    media: AniListAnime | null;
};

const ANILIST_API = "https://graphql.anilist.co";

/** How many featured anime the home hero carousel cycles through. */
const HERO_COUNT = 15;

const query = `
    query {
        topAiring: Page(page: 1, perPage: 50) {
            media(
                type: ANIME
                sort: POPULARITY_DESC
                status: RELEASING
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
                    extraLarge
                    large
                }
                bannerImage
                nextAiringEpisode {
                    episode
                }
            }
        }

        mostPopular: Page(page: 1, perPage: 50) {
            media(
                type: ANIME
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
                }
                episodes
                format
                averageScore
                genres
                coverImage {
                    large
                }
                bannerImage
                nextAiringEpisode {
                    episode
                }
            }
        }

        mostFavorite: Page(page: 1, perPage: 50) {
            media(
                type: ANIME
                sort: FAVOURITES_DESC
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
                nextAiringEpisode {
                    episode
                }
            }
        }

        recentlyAdded: Page(page: 1, perPage: 20) {
            media(
                type: ANIME
                sort: START_DATE_DESC
                status_in: [RELEASING, FINISHED, CANCELLED]
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
                nextAiringEpisode {
                    episode
                }
            }
        }

        topUpcoming: Page(page: 1, perPage: 20) {
            media(
                type: ANIME
                sort: POPULARITY_DESC
                status: NOT_YET_RELEASED
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
                nextAiringEpisode {
                    episode
                }
            }
        }

        latestCompleted: Page(page: 1, perPage: 20) {
            media(
                type: ANIME
                sort: END_DATE_DESC
                status: FINISHED
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
                nextAiringEpisode {
                    episode
                }
            }
        }

        latestEpisodes: Page(page: 1, perPage: 40) {
            airingSchedules(
                notYetAired: false
                sort: TIME_DESC
            ) {
                episode
                airingAt

                media {
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
                    nextAiringEpisode {
                        episode
                    }
                    streamingEpisodes {
                        title
                        thumbnail
                    }
                }
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
            },

            body: JSON.stringify({
                query,
            }),

            next: {
                revalidate: 3600,
            },
        });

        if (!response.ok) {
            throw new Error(
                `AniList request failed: ${response.status}`
            );
        }

        const result = await response.json();

        if (result.errors) {
            console.error(
                "AniList GraphQL errors:",
                result.errors
            );

            throw new Error(
                result.errors[0]?.message ||
                "AniList GraphQL request failed"
            );
        }

        const data = result.data;

        if (!data) {
            throw new Error("AniList returned no data");
        }

        const topAiring: AniListAnime[] =
            data.topAiring.media;

        const mostPopular: AniListAnime[] =
            data.mostPopular.media;

        const mostFavorite: AniListAnime[] =
            data.mostFavorite.media;

        const recentlyAdded: AniListAnime[] =
            data.recentlyAdded.media;

        const topUpcoming: AniListAnime[] =
            data.topUpcoming.media;

        const latestCompleted: AniListAnime[] =
            data.latestCompleted?.media ?? [];

        const airingSchedules: AiringSchedule[] =
            data.latestEpisodes?.airingSchedules ?? [];

        const mappedTopAiring = topAiring.map(mapAniListAnime);
        const mappedMostPopular = mostPopular.map(mapAniListAnime);
        const mappedMostFavorite = mostFavorite.map(mapAniListAnime);
        const mappedRecentlyAdded = recentlyAdded.map(mapAniListAnime);
        const mappedTopUpcoming = topUpcoming.map(mapAniListAnime);
        const mappedLatestCompleted =
            latestCompleted.map(mapAniListAnime);

        // "Latest Episodes": most recently aired episodes, one entry per
        // anime (keep the newest), enriched with the episode number and a
        // per-episode still when AniList exposes one.
        const providerCount = providers.length;
        const seenLatest = new Set<string>();

        const mappedLatestEpisodes = airingSchedules
            .filter((schedule): schedule is AiringSchedule & {
                media: AniListAnime;
            } => {
                if (!schedule.media) return false;

                const id = String(schedule.media.id);

                if (seenLatest.has(id)) return false;

                seenLatest.add(id);
                return true;
            })
            .slice(0, 24)
            .map((schedule) => {
                const anime = mapAniListAnime(schedule.media);

                const still = anime.streamingEpisodes.find(
                    (episode) =>
                        episode.number === schedule.episode
                )?.thumbnail;

                return {
                    ...anime,
                    latestEpisode: schedule.episode,
                    airingAt: schedule.airingAt,
                    episodeThumbnail:
                        still ||
                        anime.banner ||
                        anime.poster,
                    providerCount,
                };
            });

        // The hero carousel is the ONLY place that needs TMDB's wide backdrop
        // + stylised text logo (shown for whichever card is active). It is a
        // separate list so every anime *card* — hero cards included — keeps
        // AniList `coverImage.large`. TMDB never overrides `poster` here.
        const heroAnime = await Promise.all(
            mappedTopAiring.slice(0, HERO_COUNT).map(async (anime) => {
                try {
                    const artwork = await getTmdbArtwork(
                        anime.title,
                        anime.year
                    );

                    if (!artwork) {
                        return anime;
                    }

                    return {
                        ...anime,
                        // poster stays AniList coverImage.large
                        banner: artwork.banner ?? anime.banner,
                        logo: artwork.logo ?? null,
                    };
                } catch (error) {
                    console.error(
                        `TMDB artwork failed for ${anime.title}:`,
                        error
                    );

                    return anime;
                }
            })
        );

        return NextResponse.json({
            heroAnime,
            latestEpisodes: mappedLatestEpisodes,
            topAiring: mappedTopAiring,
            mostPopular: mappedMostPopular,
            mostFavorite: mappedMostFavorite,
            latestCompleted: mappedLatestCompleted,
            recentlyAdded: mappedRecentlyAdded,
            topUpcoming: mappedTopUpcoming,
        });
    } catch (error) {
        console.error("AniList home API error:", error);

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch homepage anime",
            },
            { status: 500 }
        );
    }
}
