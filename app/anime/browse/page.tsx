"use client";

import {
    useCallback,
    useEffect,
    useState,
} from "react";

import AnimeCard from "../../components/AnimeCard";
import type { Anime } from "../../data/anime";

const GENRES = [
    "Action",
    "Adventure",
    "Comedy",
    "Drama",
    "Fantasy",
    "Horror",
    "Mystery",
    "Romance",
    "Sci-Fi",
    "Sports",
];

const FORMATS = [
    { value: "", label: "All Types" },
    { value: "TV", label: "TV" },
    { value: "MOVIE", label: "Movie" },
    { value: "OVA", label: "OVA" },
    { value: "ONA", label: "ONA" },
    { value: "SPECIAL", label: "Special" },
];

const STATUSES = [
    { value: "", label: "All Status" },
    { value: "RELEASING", label: "Airing" },
    { value: "FINISHED", label: "Finished" },
    {
        value: "NOT_YET_RELEASED",
        label: "Upcoming",
    },
];

const SEASONS = [
    { value: "", label: "All Seasons" },
    { value: "WINTER", label: "Winter" },
    { value: "SPRING", label: "Spring" },
    { value: "SUMMER", label: "Summer" },
    { value: "FALL", label: "Fall" },
];

type BrowseResponse = {
    anime: Anime[];
    pagination: {
        currentPage: number;
        lastPage: number;
        hasNextPage: boolean;
        total: number;
    };
};

const pendingRequests = new Map<
    string,
    Promise<BrowseResponse>
>();

export default function AnimeBrowsePage() {
    const [anime, setAnime] = useState<Anime[]>([]);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] =
        useState("");

    const [genre, setGenre] = useState("");
    const [format, setFormat] = useState("");
    const [status, setStatus] = useState("");
    const [season, setSeason] = useState("");
    const [year, setYear] = useState("");

    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [lastPage, setLastPage] = useState(1);
    const [hasNextPage, setHasNextPage] =
        useState(false);

    const [loading, setLoading] = useState(true);

    /*
     * Debounce search input so typing does not
     * trigger a request for every character.
     */
    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(search);
        }, 400);

        return () => clearTimeout(timeout);
    }, [search]);

    const loadAnime = useCallback(async () => {
        setLoading(true);

        try {
            const params = new URLSearchParams();

            params.set("page", String(page));
            params.set("perPage", "24");

            if (debouncedSearch.trim()) {
                params.set(
                    "search",
                    debouncedSearch.trim()
                );
            }

            if (genre) {
                params.set("genre", genre);
            }

            if (format) {
                params.set("format", format);
            }

            if (status) {
                params.set("status", status);
            }

            if (season) {
                params.set("season", season);
            }

            if (year) {
                params.set("seasonYear", year);
            }

            const url =
                `/api/anime/browse?${params.toString()}`;

            let request = pendingRequests.get(url);

            if (!request) {
                request = fetch(url).then(
                    async (response) => {
                        const data =
                            await response.json();

                        if (!response.ok) {
                            throw new Error(
                                data.error ||
                                    "Failed to fetch anime"
                            );
                        }

                        return data;
                    }
                );

                pendingRequests.set(url, request);

                void request.then(
                    () => pendingRequests.delete(url),
                    () => pendingRequests.delete(url)
                );
            }

            const data = await request;

            setAnime(data.anime ?? []);

            setTotal(
                data.pagination?.total ?? 0
            );

            setLastPage(
                data.pagination?.lastPage ?? 1
            );

            setHasNextPage(
                data.pagination?.hasNextPage ?? false
            );
        } catch (error) {
            console.error(
                "Failed to load anime:",
                error
            );

            setAnime([]);
            setTotal(0);
            setLastPage(1);
            setHasNextPage(false);
        } finally {
            setLoading(false);
        }
    }, [
        page,
        debouncedSearch,
        genre,
        format,
        status,
        season,
        year,
    ]);

    useEffect(() => {
        loadAnime();
    }, [loadAnime]);

    const changePage = (nextPage: number) => {
        setPage(nextPage);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const updateFilter = (
        setter: (value: string) => void,
        value: string
    ) => {
        setter(value);
        setPage(1);
    };

    return (
        <main className="anime-browse-page">
            <section className="anime-browse-header">
                <span className="anime-browse-label">
                    /// ANIMEVERSE
                </span>

                <h1>ANIME BROWSE</h1>

                <p>
                    Explore the complete anime
                    catalogue.
                </p>
            </section>

            <section className="anime-browse-filters">
                <input
                    type="search"
                    placeholder="Search anime..."
                    value={search}
                    onChange={(event) =>
                        updateFilter(
                            setSearch,
                            event.target.value
                        )
                    }
                />

                <select
                    value={genre}
                    onChange={(event) =>
                        updateFilter(
                            setGenre,
                            event.target.value
                        )
                    }
                >
                    <option value="">
                        All Genres
                    </option>

                    {GENRES.map((item) => (
                        <option
                            key={item}
                            value={item}
                        >
                            {item}
                        </option>
                    ))}
                </select>

                <select
                    value={format}
                    onChange={(event) =>
                        updateFilter(
                            setFormat,
                            event.target.value
                        )
                    }
                >
                    {FORMATS.map((item) => (
                        <option
                            key={item.value}
                            value={item.value}
                        >
                            {item.label}
                        </option>
                    ))}
                </select>

                <select
                    value={status}
                    onChange={(event) =>
                        updateFilter(
                            setStatus,
                            event.target.value
                        )
                    }
                >
                    {STATUSES.map((item) => (
                        <option
                            key={item.value}
                            value={item.value}
                        >
                            {item.label}
                        </option>
                    ))}
                </select>

                <select
                    value={season}
                    onChange={(event) =>
                        updateFilter(
                            setSeason,
                            event.target.value
                        )
                    }
                >
                    {SEASONS.map((item) => (
                        <option
                            key={item.value}
                            value={item.value}
                        >
                            {item.label}
                        </option>
                    ))}
                </select>

                <input
                    type="number"
                    placeholder="Year"
                    min="1900"
                    max="2100"
                    value={year}
                    onChange={(event) =>
                        updateFilter(
                            setYear,
                            event.target.value
                        )
                    }
                />
            </section>

            <div className="anime-browse-meta">
                <span>
                    {loading
                        ? "LOADING..."
                        : `${total.toLocaleString()} ANIME`}
                </span>

                <span>
                    PAGE {page} / {lastPage}
                </span>
            </div>

            {loading ? (
                <div className="anime-browse-grid">
                    {Array.from({
                        length: 24,
                    }).map((_, index) => (
                        <div
                            key={index}
                            className="anime-card anime-card-skeleton"
                        />
                    ))}
                </div>
            ) : anime.length === 0 ? (
                <div className="anime-browse-empty">
                    NO ANIME FOUND.
                </div>
            ) : (
                <div className="anime-browse-grid">
                    {anime.map((item) => (
                        <AnimeCard
                            key={item.id}
                            id={item.id}
                            title={item.title}
                            nativeTitle={
                                item.nativeTitle
                            }
                            image={item.poster}
                            score={
                                item.score ??
                                undefined
                            }
                            episodes={
                                item.episodes ??
                                undefined
                            }
                            format={item.type}
                        />
                    ))}
                </div>
            )}

            <div className="anime-browse-pagination">
                <button
                    type="button"
                    disabled={
                        page === 1 || loading
                    }
                    onClick={() =>
                        changePage(
                            Math.max(1, page - 1)
                        )
                    }
                >
                    ‹ PREVIOUS
                </button>

                <span>
                    PAGE {page} / {lastPage}
                </span>

                <button
                    type="button"
                    disabled={
                        !hasNextPage || loading
                    }
                    onClick={() =>
                        changePage(page + 1)
                    }
                >
                    NEXT ›
                </button>
            </div>
        </main>
    );
}