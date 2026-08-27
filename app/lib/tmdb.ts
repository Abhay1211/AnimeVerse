const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

const TVDB_API = "https://api4.thetvdb.com/v4";

type TmdbSearchResult = {
    id: number;
    name?: string;
    original_name?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
};
type TmdbSearchResponse = {
    results: TmdbSearchResult[];
};

type TmdbImage = {
    file_path: string;
    vote_average: number;
    width: number;
    height: number;
};

type TmdbImagesResponse = {
    posters: TmdbImage[];
    backdrops: TmdbImage[];
    logos: TmdbImage[];
};

type TvdbSearchResult = {
    id?: string;
    tvdb_id?: string;
    name?: string;
    title?: string;
    name_translated?: string;
    year?: string;
};

type TvdbSearchResponse = {
    data?: TvdbSearchResult[];
};

type TvdbArtworkType = {
    id: number;
    name?: string;
    slug?: string;
    recordType?: string;
};

type TvdbArtwork = {
    id: number;
    image?: string;
    thumbnail?: string;
    score?: number;
    includesText?: boolean;
    language?: string;
};

type TvdbArtworksResponse = {
    data?: {
        artworks?: TvdbArtwork[];
    };
};

let tvdbToken: string | null = null;
let tvdbTokenExpiresAt = 0;
type TmdbArtwork = {
    poster: string | null;
    banner: string | null;
    logo: string | null;
};

const artworkCache = new Map<string, Promise<TmdbArtwork>>();
let tvdbLogoTypeId: number | null = null;

function getTmdbHeaders() {
    const token = process.env.TMDB_API_TOKEN;

    if (!token) {
        throw new Error("TMDB_API_TOKEN is not configured");
    }

    return {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
    };
}

function getTvdbApiKey() {
    const key = process.env.THETVDB_API_KEY;

    if (!key) {
        throw new Error("THETVDB_API_KEY is not configured");
    }

    return key;
}

async function getTvdbToken() {
    if (
        tvdbToken &&
        Date.now() < tvdbTokenExpiresAt
    ) {
        return tvdbToken;
    }

    const response = await fetch(`${TVDB_API}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            apikey: getTvdbApiKey(),
        }),
    });

    if (!response.ok) {
        throw new Error(
            `TheTVDB authentication failed: ${response.status}`
        );
    }

    const result = await response.json();
    const token = result?.data?.token;

    if (!token) {
        throw new Error(
            "TheTVDB authentication returned no token"
        );
    }

    tvdbToken = token;

    // TheTVDB tokens are valid for one month.
    // Refresh a little early.
    tvdbTokenExpiresAt =
        Date.now() + 25 * 24 * 60 * 60 * 1000;

    return token;
}

async function getTvdbHeaders() {
    const token = await getTvdbToken();

    return {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
    };
}

function imageUrl(
    path: string | null | undefined,
    size: string
) {
    return path
        ? `${TMDB_IMAGE}/${size}${path}`
        : null;
}

function normalizeTitle(title: string) {
    return title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

function findTvdbMatch(
    results: TvdbSearchResult[],
    title: string,
    year: number | null
) {
    const normalizedTitle = normalizeTitle(title);

    const exactMatch = results.find((result) => {
        const names = [
            result.name,
            result.title,
            result.name_translated,
        ].filter(Boolean) as string[];

        return names.some(
            (name) =>
                normalizeTitle(name) === normalizedTitle
        );
    });

    if (exactMatch) {
        return exactMatch;
    }

    if (year) {
        const yearMatch = results.find(
            (result) =>
                Number(result.year) === year
        );

        if (yearMatch) {
            return yearMatch;
        }
    }

    return results[0] ?? null;
}

async function getTheTvdbLogo(
    title: string,
    year: number | null
) {
    try {
        const headers = await getTvdbHeaders();

        const titleWithoutSeason = title
            .replace(
                /\s+(season|s)\s*\d+(\s*part\s*\d+)?$/i,
                ""
            )
            .replace(
                /\s+(part|cour)\s*\d+$/i,
                ""
            )
            .trim();

        const queries = [
            { query: title, year },
            { query: titleWithoutSeason, year: null },
        ];

        let show: TvdbSearchResult | null = null;

        for (const search of queries) {
            const searchParams = new URLSearchParams({
                query: search.query,
                type: "series",
                limit: "10",
            });

            if (search.year) {
                searchParams.set(
                    "year",
                    String(search.year)
                );
            }

            const searchResponse = await fetch(
                `${TVDB_API}/search?${searchParams}`,
                {
                    headers,
                    next: {
                        revalidate: 86400,
                    },
                }
            );

            if (!searchResponse.ok) {
                continue;
            }

            const searchData: TvdbSearchResponse =
                await searchResponse.json();

            show = findTvdbMatch(
                searchData.data ?? [],
                search.query,
                search.year
            );

            if (show) {
                break;
            }
        }

        const tvdbId =
            show?.tvdb_id ??
            show?.id?.replace("series-", "");

        if (!tvdbId) {
            return null;
        }

        if (!tvdbLogoTypeId) {
            const typesResponse = await fetch(
                `${TVDB_API}/artwork/types`,
                {
                    headers,
                    next: {
                        revalidate: 604800,
                    },
                }
            );

            if (!typesResponse.ok) {
                return null;
            }

            const typesResult =
                await typesResponse.json();

            const types: TvdbArtworkType[] =
                typesResult?.data ?? [];

            const logoType = types.find((type) => {
                const name =
                    type.name?.toLowerCase() ?? "";

                const slug =
                    type.slug?.toLowerCase() ?? "";

                const recordType =
                    type.recordType?.toLowerCase() ?? "";

                return (
                    recordType === "series" &&
                    (name.includes("logo") ||
                        slug.includes("logo"))
                );
            });

            if (!logoType) {
                return null;
            }

            tvdbLogoTypeId = logoType.id;
        }

        const artworkParams = new URLSearchParams({
            lang: "eng",
            type: String(tvdbLogoTypeId),
        });

        const artworksResponse = await fetch(
            `${TVDB_API}/series/${tvdbId}/artworks?${artworkParams}`,
            {
                headers,
                next: {
                    revalidate: 86400,
                },
            }
        );

        if (!artworksResponse.ok) {
            return null;
        }

        const artworksData: TvdbArtworksResponse =
            await artworksResponse.json();

        const artworks =
            artworksData.data?.artworks ?? [];

        const logo = [...artworks]
            .filter(
                (artwork) =>
                    artwork.image &&
                    artwork.includesText !== false
            )
            .sort(
                (a, b) =>
                    (b.score ?? 0) -
                    (a.score ?? 0)
            )[0];

        return logo?.image ?? null;
    } catch (error) {
        console.error(
            `TheTVDB logo lookup failed for "${title}":`,
            error
        );

        return null;
    }
}

async function fetchTmdbArtwork(
    title: string,
    year: number | null
) {
    const params = new URLSearchParams({
        query: title,
        include_adult: "false",
        language: "en-US",
        page: "1",
    });

    if (year) {
        params.set(
            "first_air_date_year",
            String(year)
        );
    }

    const searchResponse = await fetch(
        `${TMDB_API}/search/tv?${params}`,
        {
            headers: getTmdbHeaders(),
            next: {
                revalidate: 86400,
            },
        }
    );

    if (!searchResponse.ok) {
        throw new Error("TMDB search failed");
    }

    const searchData: TmdbSearchResponse =
        await searchResponse.json();

    const normalizedTitle = normalizeTitle(title);

    const exactTitleMatch = searchData.results.find(
        (result) => {
            const names = [
                result.name,
                result.original_name,
            ].filter(Boolean) as string[];

            return names.some(
                (name) =>
                    normalizeTitle(name) ===
                    normalizedTitle
            );
        }
    );

    const yearMatch = year
        ? searchData.results.find(
            (result) =>
                result.first_air_date?.startsWith(
                    String(year)
                )
        )
        : null;

    const show = exactTitleMatch ?? yearMatch;

    /*
     * If TMDB can't find the show at all,
     * still try TheTVDB for a logo.
     */
    if (!show) {
        return {
            poster: null,
            banner: null,
            logo: await getTheTvdbLogo(
                title,
                year
            ),
        };
    }

    const imagesResponse = await fetch(
        `${TMDB_API}/tv/${show.id}/images?include_image_language=en,null`,
        {
            headers: getTmdbHeaders(),
            next: {
                revalidate: 86400,
            },
        }
    );

    if (!imagesResponse.ok) {
        throw new Error(
            "TMDB images request failed"
        );
    }

    const images: TmdbImagesResponse =
        await imagesResponse.json();

    const bestLogo = [...images.logos]
        .filter((logo) => logo.file_path)
        .sort((a, b) => {
            const aScore =
                a.vote_average * 10 +
                Math.min(a.width / Math.max(a.height, 1), 10);

            const bScore =
                b.vote_average * 10 +
                Math.min(b.width / Math.max(b.height, 1), 10);

            return bScore - aScore;
        })[0];

    const tmdbLogo = imageUrl(
        bestLogo?.file_path,
        "w500"
    );

    /*
 * TMDB is the primary logo source.
 * Fall back to TheTVDB only when TMDB has no logo.
 */
    const logo =
        tmdbLogo ??
        (await getTheTvdbLogo(title, year));

    const bestPoster = images.posters
        .filter((image) => image.file_path)
        .sort(
            (a, b) =>
                (b.vote_average ?? 0) -
                (a.vote_average ?? 0)
        )[0];

    const bestBanner = [...images.backdrops]
        .filter((image) => image.file_path)
        .sort((a, b) => {
            const aScore =
                a.vote_average * 10 +
                Math.min(a.width / Math.max(a.height, 1), 3);

            const bScore =
                b.vote_average * 10 +
                Math.min(b.width / Math.max(b.height, 1), 3);

            return bScore - aScore;
        })[0];

    return {
        poster: imageUrl(
            bestPoster?.file_path,
            "w500"
        ),

        banner: imageUrl(
            bestBanner?.file_path,
            "w1280"
        ),

        logo,
    };
}
export function getTmdbArtwork(
    title: string,
    year: number | null
) {
    const key = `${normalizeTitle(title)}:${year ?? ""}`;

    const cached = artworkCache.get(key);

    if (cached) {
        return cached;
    }

    const request = fetchTmdbArtwork(title, year).catch(
        (error) => {
            artworkCache.delete(key);
            throw error;
        }
    );

    artworkCache.set(key, request);

    return request;
}