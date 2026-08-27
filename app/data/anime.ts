export type Anime = {
    id: string;
    title: string;
    nativeTitle: string;
    description: string;

    year: number | null;
    episodes: number | null;
    type: string;

    poster: string;
    banner: string | null;
    logo: string | null;

    genres: string[];
    score: number | null;

    // Detail / catalogue data
    idMal: number | null;
    popularity: number | null;
    season: string | null;
    seasonYear: number | null;

    startDate: {
        year: number | null;
        month: number | null;
        day: number | null;
    } | null;

    endDate: {
        year: number | null;
        month: number | null;
        day: number | null;
    } | null;

    status: string | null;
    duration: number | null;

    studios: string[];

    nextAiringEpisode: {
        episode: number;
        airingAt: number;
        timeUntilAiring: number;
    } | null;

    // Recommended / related media
    recommendations: AnimeRecommendation[];
    relatedMedia: AnimeRelatedMedia[];
};

export type AnimeRecommendation = {
    id: string;
    title: string;
    poster: string;
    type: string | null;
};

export type AnimeRelatedMedia = {
    id: string;
    title: string;
    nativeTitle: string;
    poster: string;
    type: string | null;
    duration: string | null;
    episodes: number | null;
    quality: string | null;
    sub: number | null;
    dub: number | null;
    relationType: string;
};

export type AniListAnime = {
    id: number;
    idMal: number | null;

    title: {
        romaji: string | null;
        english: string | null;
        native: string | null;
    };

    description: string | null;

    startDate: {
        year: number | null;
        month: number | null;
        day: number | null;
    };

    endDate: {
        year: number | null;
        month: number | null;
        day: number | null;
    };

    episodes: number | null;
    status: string | null;
    format: string | null;

    genres: string[];

    averageScore: number | null;
    popularity: number | null;

    season: string | null;
    seasonYear: number | null;

    duration: number | null;

    coverImage: {
        large: string;
    };

    bannerImage: string | null;

    studios: {
        nodes: {
            name: string;
        }[];
    };

    nextAiringEpisode: {
        episode: number;
        airingAt: number;
        timeUntilAiring: number;
    } | null;

    recommendations?: {
        nodes: {
            mediaRecommendation: {
                id: number;

                title: {
                    romaji: string | null;
                    english: string | null;
                };

                format: string | null;

                coverImage: {
                    large: string;
                };
            } | null;
        }[];
    };
    relations?: {
        edges: {
            relationType: string;

            node: {
                id: number;

                title: {
                    romaji: string | null;
                    english: string | null;
                    native: string | null;
                };

                type: string | null;

                format: string | null;

                episodes: number | null;

                duration: number | null;

                coverImage: {
                    large: string;
                };

                bannerImage: string | null;
            };
        }[];
    };
};


export function mapAniListAnime(anime: AniListAnime): Anime {
    return {
        id: String(anime.id),

        title:
            anime.title.english ||
            anime.title.romaji ||
            anime.title.native ||
            "Unknown",

        nativeTitle: anime.title.native || "",

        description: anime.description || "",

        year: anime.startDate.year,

        episodes: anime.episodes,

        type: anime.format || "TV",

        poster: anime.coverImage.large,

        banner: anime.bannerImage,

        // TMDB fills this in later.
        logo: null,

        genres: anime.genres,

        score: anime.averageScore,

        idMal: anime.idMal,

        popularity: anime.popularity,

        season: anime.season,

        seasonYear: anime.seasonYear,

        startDate: anime.startDate,

        endDate: anime.endDate,

        nextAiringEpisode: anime.nextAiringEpisode,

        status: anime.status ?? null,

        duration: anime.duration ?? null,

        studios:
            anime.studios?.nodes.map(
                (studio) => studio.name
            ) ?? [],

        recommendations:
            anime.recommendations?.nodes
                .map(
                    (item) =>
                        item.mediaRecommendation
                )
                .filter(
                    (
                        recommendation
                    ): recommendation is NonNullable<
                        typeof recommendation
                    > =>
                        recommendation !== null
                )
                .map((recommendation) => ({
                    id: String(recommendation.id),

                    title:
                        recommendation.title.english ||
                        recommendation.title.romaji ||
                        "Unknown",

                    poster:
                        recommendation.coverImage.large,

                    type: recommendation.format,
                })) ?? [],
        relatedMedia:
            anime.relations?.edges.map((relation) => ({
                id: String(relation.node.id),

                title:
                    relation.node.title.english ||
                    relation.node.title.romaji ||
                    relation.node.title.native ||
                    "Unknown",

                nativeTitle:
                    relation.node.title.native || "",

                poster: relation.node.coverImage.large,

                type: relation.node.format,

                duration: relation.node.duration
                    ? `${relation.node.duration}m`
                    : null,

                episodes: relation.node.episodes,   

                quality: null,

                sub: null,

                dub: null,
                relationType: relation.relationType,
            })) ?? [],
    };
}