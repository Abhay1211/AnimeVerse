/**
 * Canonical AniList genre list — the single source of truth shared by the
 * home genre bar (<AnimeCategories>) and the /genre/[genre] results page.
 *
 * Values are spelled exactly as AniList expects them so they can be passed
 * straight through to /api/anime/browse (`genre` query param).
 */
export const GENRES = [
    "Action",
    "Adventure",
    "Comedy",
    "Drama",
    "Ecchi",
    "Fantasy",
    "Horror",
    "Mahou Shoujo",
    "Mecha",
    "Music",
    "Mystery",
    "Psychological",
    "Romance",
    "Sci-Fi",
    "Slice of Life",
    "Sports",
    "Supernatural",
    "Thriller",
] as const;

export const GENRE_COUNT = GENRES.length;

/** Resolve a URL slug / loose string to its canonical genre spelling. */
export function resolveGenre(value: string): string | null {
    const target = value.trim().toLowerCase();

    return (
        GENRES.find((genre) => genre.toLowerCase() === target) ?? null
    );
}
