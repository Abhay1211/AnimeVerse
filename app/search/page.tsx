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
 *     existing <AnimeCard> + .anime-browse-grid. Runs automatically as the
 *     user types — the debounce, in-flight de-dupe and stale-result guard all
 *     live in useAnimeSearch (same hook the home search bar uses).
 *   - Ask AI mode: there is no AI backend yet, so the toggle switches the view
 *     but the action stays disabled (unchanged behaviour).
 *
 * Renders the shared <AnimeNavbar> exactly like the other pages.
 */
export default function SearchPage() {
    const [mode, setMode] = useState<Mode>("search");
    const [query, setQuery] = useState("");

    const { results, total, loading, error, term } = useAnimeSearch(
        mode === "search" ? query : "",
        { debounceMs: 280, perPage: 30 }
    );

    const trimmed = query.trim();
    // True while the debounce is still catching up to the current input, so a
    // freshly typed query never briefly shows "NO ANIME FOUND".
    const searching = loading || (trimmed.length > 0 && trimmed !== term);

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

                    {mode === "ai" && (
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

                {mode === "search" && !trimmed && (
                    <p className="search-page-hint">
                        Type something to search for anime.
                    </p>
                )}

                {mode === "search" && trimmed && (
                    <>
                        <div className="anime-browse-meta">
                            <span>
                                {searching
                                    ? "SEARCHING..."
                                    : error
                                    ? "SEARCH UNAVAILABLE"
                                    : `${total.toLocaleString()} RESULT${
                                          total === 1 ? "" : "S"
                                      } FOUND`}
                            </span>

                            <span>“{trimmed}”</span>
                        </div>

                        {results.length > 0 ? (
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
                        ) : (
                            !searching &&
                            !error &&
                            term.length > 0 && (
                                <div className="anime-browse-empty">
                                    NO ANIME FOUND.
                                </div>
                            )
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
