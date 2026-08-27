"use client";

import { Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAnimeSearch } from "./useAnimeSearch";

/**
 * Home-page search bar with an inline results panel.
 *
 *   - typing         -> live anime search (existing /api/anime/browse?search=)
 *                       results drop down attached to the bar; no navigation
 *   - click a result -> /anime/{id}  (same routing AnimeCard uses)
 *   - click AI_READY -> /search      (the dedicated search / AI page)
 *
 * Sits between <AnimeHero> and <AnimeCategories> on /anime.
 */
export default function AnimeSearch() {
    const router = useRouter();

    const [query, setQuery] = useState("");
    const [dismissed, setDismissed] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    const { results, total, loading, error, term } =
        useAnimeSearch(query);

    const hasQuery = query.trim().length > 0;
    const showPanel = hasQuery && !dismissed;

    // Re-open the panel as soon as the query changes again
    // (render-phase reset — no effect needed).
    const [trackedQuery, setTrackedQuery] = useState(query);

    if (query !== trackedQuery) {
        setTrackedQuery(query);
        setDismissed(false);
    }

    // Dismiss the panel on outside pointer / Escape.
    useEffect(() => {
        if (!showPanel) return;

        const onPointerDown = (event: PointerEvent) => {
            if (
                !containerRef.current?.contains(
                    event.target as Node
                )
            ) {
                setDismissed(true);
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setDismissed(true);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener(
                "pointerdown",
                onPointerDown
            );
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [showPanel]);

    const openAnime = (id: string) => {
        setQuery("");
        setDismissed(true);
        router.push(`/anime/${id}`);
    };

    const metaLabel = loading
        ? "SEARCHING..."
        : error
        ? "SEARCH UNAVAILABLE"
        : `${total} RESULT${total === 1 ? "" : "S"} FOUND`;

    return (
        <div className="anime-search" ref={containerRef}>
            <div className="anime-search-bar">
                <span className="anime-search-prefix">
                    {"/// QUERY >>>"}
                </span>

                <Search
                    className="anime-search-icon"
                    size={15}
                    aria-hidden="true"
                />

                <input
                    className="anime-search-input"
                    type="text"
                    value={query}
                    onChange={(event) =>
                        setQuery(event.target.value)
                    }
                    onFocus={() => setDismissed(false)}
                    placeholder="SEARCH ANIME OR ASK AI..."
                    aria-label="Search anime"
                    autoComplete="off"
                    spellCheck={false}
                />

                <button
                    type="button"
                    className="anime-search-ai"
                    onClick={() => router.push("/search")}
                >
                    <span>AI_READY</span>
                    <Sparkles size={13} aria-hidden="true" />
                </button>
            </div>

            {showPanel && (
                <div className="anime-search-panel">
                    <div className="anime-search-panel-meta">
                        {metaLabel}
                    </div>

                    {!loading &&
                        !error &&
                        results.length === 0 &&
                        term.length > 0 && (
                            <div className="anime-search-empty">
                                NO ANIME MATCHED “{term}”
                            </div>
                        )}

                    {results.length > 0 && (
                        <ul className="anime-search-results">
                            {results.map((anime, index) => (
                                <li key={anime.id}>
                                    <button
                                        type="button"
                                        className="anime-search-result"
                                        onClick={() =>
                                            openAnime(anime.id)
                                        }
                                    >
                                        <span className="anime-search-result-index">
                                            {String(
                                                index + 1
                                            ).padStart(2, "0")}
                                        </span>

                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            className="anime-search-result-thumb"
                                            src={anime.poster}
                                            alt=""
                                            loading="lazy"
                                        />

                                        <span className="anime-search-result-body">
                                            <span className="anime-search-result-title">
                                                {anime.title}
                                            </span>

                                            <span className="anime-search-result-sub">
                                                {anime.year ??
                                                    "—"}
                                                {anime.episodes
                                                    ? ` · ${anime.episodes} EP`
                                                    : ""}
                                            </span>
                                        </span>

                                        {anime.type && (
                                            <span className="anime-search-result-badge">
                                                {anime.type}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
