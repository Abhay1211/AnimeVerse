"use client";

import { ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import AnimeCard from "../components/AnimeCard";
import AnimeNavbar from "../components/AnimeNavbar";
import GenreFilter from "../components/GenreFilter";
import { GENRES, resolveGenre } from "../data/genres";
import type { Anime } from "../data/anime";

const PER_PAGE = 24;
const FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"];
const STATUSES = ["RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"];
const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, index) => String(CURRENT_YEAR - index));

type BrowseState = {
    anime: Anime[];
    total: number;
    hasNextPage: boolean;
    loading: boolean;
    error: boolean;
};

const EMPTY_STATE: BrowseState = {
    anime: [],
    total: 0,
    hasNextPage: false,
    loading: true,
    error: false,
};

type SearchParamsLike = {
    get(name: string): string | null;
    getAll(name: string): string[];
};

function parsePage(value: string | null): number {
    const page = Number(value || "1");
    return Number.isInteger(page) && page > 0 ? page : 1;
}

function selectedGenresFromParams(searchParams: SearchParamsLike): string[] {
    const values = searchParams.get("genres")?.split(",") ?? searchParams.getAll("genre");
    return values
        .map((value) => resolveGenre(value))
        .filter((value): value is string => value !== null);
}

function labelFor(value: string): string {
    return value.replaceAll("_", " ");
}

function BrowseContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const page = parsePage(searchParams.get("page"));
    const selectedGenres = useMemo(
        () => selectedGenresFromParams(searchParams),
        [searchParams]
    );
    const format = searchParams.get("format") ?? "";
    const status = searchParams.get("status") ?? "";
    const season = searchParams.get("season") ?? "";
    const seasonYear = searchParams.get("seasonYear") ?? "";
    const urlSearch = searchParams.get("search") ?? "";
    const requestKey = `${page}|${selectedGenres.join(",")}|${format}|${status}|${season}|${seasonYear}|${urlSearch}`;

    const [state, setState] = useState<BrowseState>(EMPTY_STATE);
    const [trackedRequestKey, setTrackedRequestKey] = useState(requestKey);

    if (requestKey !== trackedRequestKey) {
        setTrackedRequestKey(requestKey);
        setState((previous) => ({ ...previous, loading: true, error: false }));
    }

    // Free-text search. Debounced into the `?search=` param so it composes with
    // the existing filters — `/api/anime/browse` already accepts `search`
    // alongside genre/format/status/season/year.
    const [searchInput, setSearchInput] = useState(urlSearch);
    const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch);
    if (urlSearch !== seenUrlSearch) {
        // URL changed from outside our debounce (back/forward, Clear) — reseed.
        setSeenUrlSearch(urlSearch);
        setSearchInput(urlSearch);
    }

    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === urlSearch) return;

        const id = window.setTimeout(() => {
            setSeenUrlSearch(trimmed);
            const next = new URLSearchParams(searchParams.toString());
            if (trimmed) next.set("search", trimmed);
            else next.delete("search");
            next.delete("page");
            router.replace(`${pathname}?${next.toString()}`);
        }, 280);

        return () => window.clearTimeout(id);
    }, [searchInput, urlSearch, searchParams, pathname, router]);

    useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams({
            page: String(page),
            perPage: String(PER_PAGE),
        });

        selectedGenres.forEach((genre) => params.append("genre", genre));
        if (format) params.set("format", format);
        if (status) params.set("status", status);
        if (season) params.set("season", season);
        if (seasonYear) params.set("seasonYear", seasonYear);
        if (urlSearch) params.set("search", urlSearch);

        fetch(`/api/anime/browse?${params.toString()}`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || "Browse request failed");
                return data as {
                    anime?: Anime[];
                    pagination?: { total?: number; hasNextPage?: boolean };
                };
            })
            .then((data) => {
                if (cancelled) return;
                setState({
                    anime: data.anime ?? [],
                    total: data.pagination?.total ?? 0,
                    hasNextPage: Boolean(data.pagination?.hasNextPage),
                    loading: false,
                    error: false,
                });
            })
            .catch((error) => {
                if (cancelled) return;
                if (process.env.NODE_ENV !== "production") {
                    console.error("Failed to load browse results:", error);
                }
                setState({ anime: [], total: 0, hasNextPage: false, loading: false, error: true });
            });

        return () => {
            cancelled = true;
        };
    }, [format, page, requestKey, season, seasonYear, selectedGenres, status, urlSearch]);

    const updateParams = (updates: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
        });
        router.push(`${pathname}?${next.toString()}`);
    };

    const applyGenres = (genres: string[]) => {
        updateParams({ genres: genres.length ? genres.join(",") : null, page: null });
    };

    const clearFilters = () => {
        router.push(pathname);
    };

    const hasFilters = selectedGenres.length > 0 || Boolean(format || status || season || seasonYear);

    // Active dropdown filters shown as removable chips outside the filter row.
    const activeChips: { key: string; label: string; onRemove: () => void }[] = [
        ...(format ? [{ key: "format", label: `Format: ${labelFor(format)}`, onRemove: () => updateParams({ format: null, page: null }) }] : []),
        ...(status ? [{ key: "status", label: `Status: ${labelFor(status)}`, onRemove: () => updateParams({ status: null, page: null }) }] : []),
        ...(season ? [{ key: "season", label: `Season: ${labelFor(season)}`, onRemove: () => updateParams({ season: null, page: null }) }] : []),
        ...(seasonYear ? [{ key: "seasonYear", label: `Year: ${seasonYear}`, onRemove: () => updateParams({ seasonYear: null, page: null }) }] : []),
        ...selectedGenres.map((genre) => ({
            key: `genre:${genre}`,
            label: `Genre: ${genre}`,
            onRemove: () => applyGenres(selectedGenres.filter((item) => item !== genre)),
        })),
    ];

    return (
        <>
            <AnimeNavbar />
            <main className="anime-browse-page browse-discovery-page">
                <header className="anime-browse-header browse-discovery-header">
                    <span className="anime-browse-label">{"/// DISCOVER ANIME"}</span>
                    <h1>Browse Anime</h1>
                    <p>Explore the catalog by genre, format, status, season, and year.</p>
                </header>

                <div className="browse-search">
                    <Search size={15} aria-hidden="true" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search the anime catalog..."
                        aria-label="Search anime catalog"
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <section className="browse-discovery-controls" aria-label="Anime filters">
                    <GenreFilter allGenres={GENRES} selected={selectedGenres} onApply={applyGenres} autoApply />
                    <label>
                        <span>FORMAT</span>
                        <select value={format} onChange={(event) => updateParams({ format: event.target.value || null, page: null })}>
                            <option value="">All formats</option>
                            {FORMATS.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>STATUS</span>
                        <select value={status} onChange={(event) => updateParams({ status: event.target.value || null, page: null })}>
                            <option value="">All statuses</option>
                            {STATUSES.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>SEASON</span>
                        <select value={season} onChange={(event) => updateParams({ season: event.target.value || null, page: null })}>
                            <option value="">All seasons</option>
                            {SEASONS.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>YEAR</span>
                        <select value={seasonYear} onChange={(event) => updateParams({ seasonYear: event.target.value || null, page: null })}>
                            <option value="">All years</option>
                            {YEARS.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </label>
                    {hasFilters && <button type="button" className="browse-discovery-clear" onClick={clearFilters}><RotateCcw size={14} /> CLEAR</button>}
                </section>

                {activeChips.length > 0 && (
                    <div className="browse-active-filters" aria-label="Active filters">
                        {activeChips.map((chip) => (
                            <span key={chip.key} className="browse-active-filter">
                                {chip.label}
                                <button type="button" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>×</button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="anime-browse-meta">
                    <span>{state.loading ? "LOADING..." : state.error ? "BROWSE UNAVAILABLE" : `${state.total.toLocaleString()} RESULTS`}</span>
                    <span>PAGE {page}</span>
                </div>

                {state.loading ? (
                    <div className="anime-browse-grid">
                        {Array.from({ length: 12 }, (_, index) => <div key={index} className="anime-card anime-card-skeleton" />)}
                    </div>
                ) : state.error ? (
                    <div className="anime-browse-empty">COULDN&apos;T LOAD THE CATALOG. PLEASE TRY AGAIN.</div>
                ) : state.anime.length === 0 ? (
                    <div className="anime-browse-empty">NO ANIME MATCHED THESE FILTERS.</div>
                ) : (
                    <div className="anime-browse-grid">
                        {state.anime.map((anime) => <AnimeCard key={anime.id} id={anime.id} title={anime.title} nativeTitle={anime.nativeTitle} image={anime.poster} score={anime.score ?? undefined} episodes={anime.episodes ?? undefined} format={anime.type} />)}
                    </div>
                )}

                <div className="anime-browse-pagination">
                    <button type="button" disabled={page === 1 || state.loading} onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}><ChevronLeft size={14} /> PREVIOUS</button>
                    <span>PAGE {page}</span>
                    <button type="button" disabled={!state.hasNextPage || state.loading} onClick={() => updateParams({ page: String(page + 1) })}>NEXT <ChevronRight size={14} /></button>
                </div>
            </main>
        </>
    );
}

export default function BrowsePage() {
    return (
        <Suspense fallback={<AnimeNavbar />}>
            <BrowseContent />
        </Suspense>
    );
}
