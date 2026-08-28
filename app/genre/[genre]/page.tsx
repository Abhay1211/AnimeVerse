"use client";

import {
    useParams,
    useRouter,
    useSearchParams,
} from "next/navigation";
import {
    useEffect,
    useMemo,
    useState,
} from "react";

import AnimeCard from "../../components/AnimeCard";
import AnimeNavbar from "../../components/AnimeNavbar";
import GenreFilter from "../../components/GenreFilter";
import { GENRES, resolveGenre } from "../../data/genres";
import type { Anime } from "../../data/anime";

type ViewMode = "grid" | "list";

const PER_PAGE = 24;

/** Build the canonical URL for a genre selection + page. */
function buildHref(genreList: string[], page: number): string {
    const [primary, ...rest] = genreList;

    const params = new URLSearchParams();

    if (rest.length > 0) {
        params.set("genres", genreList.join(","));
    }

    if (page > 1) {
        params.set("page", String(page));
    }

    const queryString = params.toString();

    return `/genre/${encodeURIComponent(primary)}${
        queryString ? `?${queryString}` : ""
    }`;
}

export default function GenrePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const rawGenre = decodeURIComponent(
        String(params.genre ?? "")
    );

    const page = Math.max(
        1,
        Number(searchParams.get("page") || "1")
    );

    // Selected genres come from ?genres=... when present, otherwise the
    // single genre in the route. Everything is normalised to canonical
    // spelling so it matches both the API and the filter list.
    const selectedGenres = useMemo(() => {
        const fromQuery = searchParams.get("genres");

        const rawList = fromQuery
            ? fromQuery.split(",")
            : [rawGenre];

        const normalised = rawList
            .map((value) => resolveGenre(value))
            .filter((value): value is string => value !== null);

        if (normalised.length > 0) return normalised;

        const fallback = resolveGenre(rawGenre);

        return fallback ? [fallback] : [rawGenre];
    }, [searchParams, rawGenre]);

    const [anime, setAnime] = useState<Anime[]>([]);
    const [totalByKey, setTotalByKey] = useState<
        Record<string, { total: number; capped: boolean }>
    >({});
    const [hasNextPage, setHasNextPage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewMode>("grid");

    const genreKey = selectedGenres.join("|");

    useEffect(() => {
        let cancelled = false;

        const loadAnime = async () => {
            setLoading(true);

            try {
                const requestParams = new URLSearchParams();

                requestParams.set("page", String(page));
                requestParams.set(
                    "perPage",
                    String(PER_PAGE)
                );

                selectedGenres.forEach((genre) =>
                    requestParams.append("genre", genre)
                );

                const response = await fetch(
                    `/api/anime/browse?${requestParams.toString()}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                            "Failed to fetch anime"
                    );
                }

                if (cancelled) return;

                const rows: Anime[] = data.anime ?? [];

                setAnime(rows);

                // A full page means there is very likely another one; a
                // short page means we're at the end.
                setHasNextPage(rows.length === PER_PAGE);
            } catch (error) {
                if (cancelled) return;

                console.error(
                    "Failed to load genre anime:",
                    error
                );

                setAnime([]);
                setHasNextPage(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadAnime();

        return () => {
            cancelled = true;
        };
        // `genreKey` is the stable string form of `selectedGenres`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [genreKey, page]);

    /*
     * Accurate genre total — a separate, heavier probe that must not block
     * the results above. Cached per genre selection, so switching back to a
     * genre shows its count instantly.
     */
    useEffect(() => {
        let cancelled = false;
        const key = genreKey;

        const params = new URLSearchParams();
        params.set("countOnly", "1");
        selectedGenres.forEach((genre) =>
            params.append("genre", genre)
        );

        fetch(`/api/anime/browse?${params.toString()}`)
            .then((response) => response.json())
            .then((data) => {
                if (cancelled) return;

                if (typeof data.pagination?.total === "number") {
                    setTotalByKey((prev) => ({
                        ...prev,
                        [key]: {
                            total: data.pagination.total,
                            capped: Boolean(
                                data.pagination.totalIsCapped
                            ),
                        },
                    }));
                }
            })
            .catch(() => {
                /* leave the count as "…" on failure */
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [genreKey]);

    const heading = selectedGenres[0] ?? rawGenre;
    const currentTotal = totalByKey[genreKey] ?? null;

    const applySelection = (next: string[]) => {
        // No genres left → leave the genre/browse experience entirely.
        if (next.length === 0) {
            router.push("/anime");
            return;
        }

        router.push(buildHref(next, 1));
    };

    const changePage = (nextPage: number) => {
        router.push(buildHref(selectedGenres, nextPage));

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <>
            <AnimeNavbar />

            <main className="anime-browse-page genre-page">
                <section className="genre-page-top">
                    <span className="genre-page-eyebrow">
                        Genres
                        <span className="genre-page-count">
                            {GENRES.length}
                        </span>
                    </span>

                    <div className="genre-page-headrow">
                        <div>
                            <h1>{heading}</h1>

                            <p className="genre-page-results">
                                {currentTotal === null
                                    ? "…"
                                    : `${currentTotal.total.toLocaleString()}${
                                          currentTotal.capped
                                              ? "+"
                                              : ""
                                      } result${
                                          currentTotal.total === 1
                                              ? ""
                                              : "s"
                                      }`}{" "}
                                · page {page}
                            </p>
                        </div>

                        <div className="genre-view-toggle">
                            <button
                                type="button"
                                className={
                                    view === "grid"
                                        ? "is-active"
                                        : ""
                                }
                                onClick={() =>
                                    setView("grid")
                                }
                            >
                                GRID
                            </button>

                            <button
                                type="button"
                                className={
                                    view === "list"
                                        ? "is-active"
                                        : ""
                                }
                                onClick={() =>
                                    setView("list")
                                }
                            >
                                LIST
                            </button>
                        </div>
                    </div>

                    <div className="genre-page-filterrow">
                        <GenreFilter
                            allGenres={GENRES}
                            selected={selectedGenres}
                            onApply={applySelection}
                        />

                        {selectedGenres.map((genre) => (
                            <button
                                key={genre}
                                type="button"
                                className="genre-chip"
                                onClick={() =>
                                    applySelection(
                                        selectedGenres.filter(
                                            (item) =>
                                                item !== genre
                                        )
                                    )
                                }
                                aria-label={`Remove ${genre}`}
                            >
                                {genre}
                                <span aria-hidden="true">
                                    ×
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                {loading ? (
                    <div className="anime-browse-grid">
                        {Array.from({
                            length: PER_PAGE,
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
                    <div
                        className={
                            view === "grid"
                                ? "anime-browse-grid"
                                : "genre-results-list"
                        }
                    >
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
                                    item.score ?? undefined
                                }
                                episodes={
                                    item.episodes ??
                                    undefined
                                }
                                format={item.type}
                                layout={view}
                            />
                        ))}
                    </div>
                )}

                <div className="anime-browse-pagination">
                    <button
                        type="button"
                        disabled={page === 1 || loading}
                        onClick={() =>
                            changePage(Math.max(1, page - 1))
                        }
                    >
                        ‹ PREVIOUS
                    </button>

                    <span>PAGE {page}</span>

                    <button
                        type="button"
                        disabled={!hasNextPage || loading}
                        onClick={() =>
                            changePage(page + 1)
                        }
                    >
                        NEXT ›
                    </button>
                </div>
            </main>
        </>
    );
}
