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

    // Per-episode metadata (AniList streamingEpisodes → Crunchyroll listings).
    // Coverage varies per title: full, partial, or empty.
    streamingEpisodes: StreamingEpisode[];

    /**
     * Distinct TV seasons in this anime's franchise. Only the anime-detail
     * API populates this (it walks the AniList prequel/sequel chain); list
     * endpoints leave it undefined.
     */
    totalSeasons?: number;
};

export type StreamingEpisode = {
    /** Episode number parsed from the listing title. */
    number: number;
    /** Episode name without the "Episode N -" prefix. */
    title: string;
    thumbnail: string | null;
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
    seasonYear: number | null;
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
        extraLarge?: string | null;
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

    streamingEpisodes?: {
        title: string | null;
        thumbnail: string | null;
    }[];

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

                season: string | null;

                seasonYear: number | null;

                coverImage: {
                    large: string;
                };

                bannerImage: string | null;
            };
        }[];
    };
};


/** Parse an AniList streamingEpisodes entry ("Episode 12 - Some Title"). */
function parseStreamingEpisode(entry: {
    title: string | null;
    thumbnail: string | null;
}): StreamingEpisode | null {
    const raw = (entry.title || "").trim();
    const match = raw.match(/^episode\s+(\d+)\s*(?:[-–—:.]\s*)?(.*)$/i);

    if (!match) return null;

    const number = Number(match[1]);
    const title = match[2].trim();

    return {
        number,
        title: title || `Episode ${number}`,
        thumbnail: entry.thumbnail || null,
    };
}

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

        // AniList only fills `episodes` once a run has a known total, so
        // long-running shows (One Piece, …) report null. When the series is
        // still airing we fall back to the count aired so far — a real,
        // uncapped number — rather than showing nothing.
        episodes:
            anime.episodes ??
            (anime.nextAiringEpisode
                ? Math.max(
                      0,
                      anime.nextAiringEpisode.episode - 1
                  )
                : null),

        type: anime.format || "TV",

        poster:
            anime.coverImage.extraLarge ||
            anime.coverImage.large,

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

                seasonYear: relation.node.seasonYear ?? null,

                quality: null,

                sub: null,

                dub: null,
                relationType: relation.relationType,
            })) ?? [],

        streamingEpisodes: (anime.streamingEpisodes ?? [])
            .map(parseStreamingEpisode)
            .filter(
                (episode): episode is StreamingEpisode =>
                    episode !== null
            ),
    };
}

/* ============================================================
   WATCH STRUCTURE
   Normalises an anime + its AniList relations into the shape the
   watch page renders: real TV seasons, a separate movie list, and
   the episode count for the season being watched.

   Rules:
   - A "season" is the current entry plus any DIRECTLY related
     PREQUEL / SEQUEL entry whose AniList format is TV or TV_SHORT.
     AniList only exposes adjacent entries, so this is the local
     neighbourhood of the chain, not a recursive walk.
   - Season numbers come from the entries' own titles when every
     entry has an unambiguous number ("Season 3", "3rd Season",
     "Season III"); otherwise they are positional (1..N). A show
     with a single TV entry is therefore always "Season 1".
   - A MOVIE is never a season and never an episode. Franchise
     movies are collected into `movies`.
   - SPECIAL / OVA / MUSIC / MANGA / NOVEL relations are excluded
     from seasons, movies and the episode list.
   ============================================================ */

export type WatchSeason = {
    seasonNumber: number;
    id: string;
    title: string;
    label: string;
    format: string;
    episodeCount: number | null;
    isCurrent: boolean;
};

export type WatchMovie = {
    id: string;
    title: string;
    poster: string;
};

export type WatchStructure = {
    seasons: WatchSeason[];
    movies: WatchMovie[];
    currentSeasonNumber: number;
    currentIsMovie: boolean;
    /** Episodes for the season currently being watched. */
    episodeCount: number;
};

const TV_SEASON_FORMATS = new Set(["TV", "TV_SHORT"]);
const SEASON_CHAIN_RELATIONS = new Set(["PREQUEL", "SEQUEL"]);
const MOVIE_RELATIONS = new Set([
    "PREQUEL",
    "SEQUEL",
    "SIDE_STORY",
    "PARENT",
    "SUMMARY",
    "ALTERNATIVE",
]);

const ROMAN: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
};

/** Extract an explicit season number from an AniList title, or null. */
function seasonNumberFromTitle(title: string): number | null {
    const t = ` ${title.toLowerCase()} `;

    const nth = t.match(/(\d+)(?:st|nd|rd|th)\s+season/);
    if (nth) return Number(nth[1]);

    const digits = t.match(/season\s+(\d+)/);
    if (digits) return Number(digits[1]);

    const romanNamed = t.match(
        /season\s+(viii|vii|vi|iv|iii|ii|ix|x|v|i)\b/
    );
    if (romanNamed) return ROMAN[romanNamed[1]] ?? null;

    const romanTrailing = t.match(/\s(viii|vii|vi|iv|iii|ii|ix|x)\s*$/);
    if (romanTrailing) return ROMAN[romanTrailing[1].trim()] ?? null;

    return null;
}

export function buildWatchStructure(anime: Anime): WatchStructure {
    const currentFormat = (anime.type || "TV").toUpperCase();
    const currentIsMovie = currentFormat === "MOVIE";

    const airedFallback = anime.nextAiringEpisode
        ? anime.nextAiringEpisode.episode - 1
        : 0;

    // --- Franchise movies (never episodes, never seasons) ---
    const movies: WatchMovie[] = [];
    const seenMovie = new Set<string>();

    for (const related of anime.relatedMedia) {
        if ((related.type || "").toUpperCase() !== "MOVIE") continue;
        if (!MOVIE_RELATIONS.has(related.relationType)) continue;
        if (seenMovie.has(related.id)) continue;

        seenMovie.add(related.id);
        movies.push({
            id: related.id,
            title: related.title,
            poster: related.poster,
        });
    }

    if (currentIsMovie) {
        return {
            seasons: [],
            movies,
            currentSeasonNumber: 0,
            currentIsMovie: true,
            episodeCount: 1,
        };
    }

    // --- TV season chain (current + adjacent TV prequels/sequels) ---
    type ChainNode = {
        id: string;
        title: string;
        format: string;
        episodeCount: number | null;
        seasonYear: number | null;
        direction: -1 | 0 | 1;
    };

    const chain: ChainNode[] = [
        {
            id: anime.id,
            title: anime.title,
            format: currentFormat,
            episodeCount: anime.episodes,
            seasonYear: anime.seasonYear,
            direction: 0,
        },
    ];

    for (const related of anime.relatedMedia) {
        if (!SEASON_CHAIN_RELATIONS.has(related.relationType)) continue;
        if (
            !TV_SEASON_FORMATS.has((related.type || "").toUpperCase())
        )
            continue;
        if (chain.some((node) => node.id === related.id)) continue;

        chain.push({
            id: related.id,
            title: related.title,
            format: (related.type || "TV").toUpperCase(),
            episodeCount: related.episodes,
            seasonYear: related.seasonYear,
            direction:
                related.relationType === "PREQUEL" ? -1 : 1,
        });
    }

    chain.sort((a, b) => {
        if (a.direction !== b.direction)
            return a.direction - b.direction;
        if (
            a.seasonYear &&
            b.seasonYear &&
            a.seasonYear !== b.seasonYear
        )
            return a.seasonYear - b.seasonYear;
        return a.title.localeCompare(b.title);
    });

    const parsed = chain.map((node) =>
        seasonNumberFromTitle(node.title)
    );
    const useParsed =
        parsed.every((value) => value != null) &&
        new Set(parsed).size === parsed.length;

    let seasons: WatchSeason[] = chain.map((node, index) => {
        const number = useParsed
            ? (parsed[index] as number)
            : index + 1;

        return {
            seasonNumber: number,
            id: node.id,
            title: node.title,
            label: `Season ${number}`,
            format: node.format,
            episodeCount: node.episodeCount,
            isCurrent: node.id === anime.id,
        };
    });

    if (useParsed) {
        seasons = [...seasons].sort(
            (a, b) => a.seasonNumber - b.seasonNumber
        );
    }

    const current = seasons.find((season) => season.isCurrent);

    return {
        seasons,
        movies,
        currentSeasonNumber: current?.seasonNumber ?? 1,
        currentIsMovie: false,
        episodeCount: Math.max(
            anime.episodes ?? 0,
            airedFallback,
            0
        ),
    };
}

/* ============================================================
   DISPLAY / DERIVED-VALUE HELPERS
   Single source of truth for how AniList numbers become UI text.
   ============================================================ */

/**
 * AniList `Media.averageScore` is a 0–100 integer. Anime Verse shows an
 * out-of-10 rating: `84 → "8.4"`, `90 → "9.0"`. Returns `null` when there is
 * no score so the caller can hide the badge.
 */
export function formatScore(
    score: number | null | undefined
): string | null {
    if (score == null || Number.isNaN(score)) return null;
    return (score / 10).toFixed(1);
}

/**
 * Card / list metadata line built from the anime's real values:
 *   TV      + 14   → "TV · 14 EP"
 *   MOVIE   + 1    → "MOVIE"           (movies never show an episode count)
 *   TV      + null → "TV"
 *   OVA     + 4    → "OVA · 4 EP"
 *
 * `episodes` is always AniList `Media.episodes` (the anime's own total, which
 * can legitimately be 1000+); it is never a pagination total or page size.
 */
export function formatEpisodeMeta(
    format: string | null | undefined,
    episodes: number | null | undefined
): string {
    const label = format || "";
    const isMovie = label.toUpperCase() === "MOVIE";

    if (isMovie || episodes == null || episodes < 1) {
        return label;
    }

    return label ? `${label} · ${episodes} EP` : `${episodes} EP`;
}

/** Strip split-cour markers so "… Season 2 Part 2" / "… Cour 2" fold onto their base. */
function stripSeasonSplitMarkers(title: string): string {
    return title
        .replace(
            /\s*[-–—:]?\s*(?:part|cour|kai)\s+(?:\d+|i{1,3}|iv|vi{0,3}|v)\b.*$/i,
            ""
        )
        .replace(
            /\s*(?:\d+(?:st|nd|rd|th)|first|second|third|final)\s+(?:part|cour)\b.*$/i,
            ""
        )
        .replace(/\s*[-–—:]\s*$/, "")
        .trim();
}

/**
 * How many distinct TV seasons a franchise has, given the walked
 * prequel/sequel chain (TV / TV_SHORT entries, ordered by year).
 *
 *   - entries with an explicit "Season N" / "Nth Season" group by N
 *     → "Season 2" and "Season 2 Part 2" count once
 *   - unnumbered entries cluster with their adjacent split parts
 *     → "The Final Season" + "… Part 2" + "… Part 3" count once
 *     → a plain "S1" and a plain "S2" (both unnumbered) still count twice
 *
 * Handles One Piece (1), Mushoku Tensei (3), Re:ZERO (3) correctly and
 * never hardcodes a number.
 */
export function countFranchiseSeasons(
    chain: { title: string }[]
): number {
    if (chain.length === 0) return 1;

    const numbered = new Set<number>();
    let unnumberedClusters = 0;
    let prevUnnumberedBase: string | null = null;

    for (const entry of chain) {
        const n = seasonNumberFromTitle(entry.title);

        if (n != null) {
            numbered.add(n);
            prevUnnumberedBase = null;
            continue;
        }

        const base = stripSeasonSplitMarkers(entry.title).toLowerCase();

        if (base !== prevUnnumberedBase) {
            unnumberedClusters += 1;
            prevUnnumberedBase = base;
        }
    }

    return Math.max(1, numbered.size + unnumberedClusters);
}
