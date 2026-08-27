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
 *     /api/anime/browse?search= endpoint, rendered with the existing
 *     <AnimeCard> + .anime-browse-grid.
 *   - Ask AI mode: placeholder — there is no AI backend in the project yet,
 *     so the toggle switches the view but the action is disabled.
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
                <section className="anime-browse-header">
                    <span className="anime-browse-label">
                        {"/// ANIMEVERSE — QUERY"}
                    </span>

                    <h1>SEARCH</h1>

                    <p>Find an anime, or ask the AI.</p>
                </section>

                <div className="search-page-toggle">
                    <button
                        type="button"
                        className={
                            mode === "search" ? "is-active" : ""
                        }
                        onClick={() => setMode("search")}
                        aria-pressed={mode === "search"}
                    >
                        SEARCH
                    </button>

                    <button
                        type="button"
                        className={mode === "ai" ? "is-active" : ""}
                        onClick={() => setMode("ai")}
                        aria-pressed={mode === "ai"}
                    >
                        ASK AI
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
                                ? "SEARCH ANIME..."
                                : "ASK THE AI ANYTHING ABOUT ANIME..."
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
                            SEARCH
                            <span aria-hidden="true">
                                &gt;&gt;&gt;
                            </span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="search-page-submit"
                            disabled
                            title="AI chat is not available yet"
                        >
                            ASK
                            <Sparkles
                                size={13}
                                aria-hidden="true"
                            />
                        </button>
                    )}
                </div>

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
                    <div className="search-page-ai-note">
                        AI CHAT IS NOT AVAILABLE YET — SWITCH TO
                        SEARCH MODE TO FIND ANIME.
                    </div>
                )}
            </main>
        </>
    );
}
