"use client";

import { Search, Sparkles } from "lucide-react";
import { useState } from "react";

import AnimeCard from "../components/AnimeCard";
import AnimeNavbar from "../components/AnimeNavbar";
import { useAnimeSearch } from "../components/useAnimeSearch";

type Mode = "search" | "ai";

/**
 * Dedicated search / AI page.
 *
 *   - Search mode (default): anime search via the existing
 *     /api/anime/browse?search= endpoint (useAnimeSearch), rendered with the
 *     existing <AnimeCard> + .anime-browse-grid.
 *   - Ask AI mode: there is no AI backend yet, so the toggle switches the view
 *     but the action stays disabled (unchanged behaviour).
 *
 * Renders the shared <AnimeNavbar> exactly like the other pages.
 */
export default function SearchPage() {
    const [mode, setMode] = useState<Mode>("search");
    const [query, setQuery] = useState("");
    const [submitted, setSubmitted] = useState("");

    // Submit-driven on this page (button / Enter), so no typing debounce.
    const { results, total, loading, error, term } = useAnimeSearch(
        submitted,
        { debounceMs: 0, perPage: 30 }
    );

    const runSearch = () => {
        setSubmitted(query.trim());
    };

    return (
        <>
            <AnimeNavbar />

            <main className="anime-browse-page search-page">
                <div className="search-page-toggle">
                    <button
                        type="button"
                        className={
                            mode === "search" ? "is-active" : ""
                        }
                        onClick={() => setMode("search")}
                        aria-pressed={mode === "search"}
                    >
                        <Search size={13} aria-hidden="true" />
                        Search
                    </button>

                    <button
                        type="button"
                        className={mode === "ai" ? "is-active" : ""}
                        onClick={() => setMode("ai")}
                        aria-pressed={mode === "ai"}
                    >
                        <Sparkles size={13} aria-hidden="true" />
                        Ask AI
                    </button>
                </div>

                <div className="search-page-bar">
                    <Search
                        className="search-page-icon"
                        size={16}
                        aria-hidden="true"
                    />

                    <input
                        type="text"
                        value={query}
                        onChange={(event) =>
                            setQuery(event.target.value)
                        }
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" &&
                                mode === "search"
                            ) {
                                runSearch();
                            }
                        }}
                        placeholder={
                            mode === "search"
                                ? "Search anime..."
                                : "Ask the AI anything about anime..."
                        }
                        aria-label={
                            mode === "search"
                                ? "Search anime"
                                : "Ask AI"
                        }
                        autoComplete="off"
                        spellCheck={false}
                    />

                    {mode === "search" ? (
                        <button
                            type="button"
                            className="search-page-submit"
                            onClick={runSearch}
                        >
                            Search
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="search-page-submit"
                            disabled
                            title="AI chat is not available yet"
                        >
                            Ask
                        </button>
                    )}
                </div>

                {mode === "search" && !submitted && (
                    <p className="search-page-hint">
                        Type something to search for anime.
                    </p>
                )}

                {mode === "search" && submitted && (
                    <>
                        <div className="anime-browse-meta">
                            <span>
                                {loading
                                    ? "SEARCHING..."
                                    : error
                                    ? "SEARCH UNAVAILABLE"
                                    : `${total.toLocaleString()} RESULT${
                                          total === 1 ? "" : "S"
                                      } FOUND`}
                            </span>

                            <span>“{term}”</span>
                        </div>

                        {!loading &&
                        !error &&
                        results.length === 0 ? (
                            <div className="anime-browse-empty">
                                NO ANIME FOUND.
                            </div>
                        ) : (
                            <div className="anime-browse-grid">
                                {results.map((anime) => (
                                    <AnimeCard
                                        key={anime.id}
                                        id={anime.id}
                                        title={anime.title}
                                        nativeTitle={
                                            anime.nativeTitle
                                        }
                                        image={anime.poster}
                                        score={
                                            anime.score ??
                                            undefined
                                        }
                                        episodes={
                                            anime.episodes ??
                                            undefined
                                        }
                                        format={anime.type}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {mode === "ai" && (
                    <p className="search-page-hint">
                        AI chat is not available yet — switch to
                        Search to find anime.
                    </p>
                )}
            </main>
        </>
    );
}
