"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { WatchMovie, WatchSeason } from "../data/anime";
import { watchPill, watchSearchInput, watchSectionHeading } from "./watchUi";

export type NextAiring = {
    episode: number;
    airingAt: number;
    timeUntilAiring: number;
} | null;

/**
 * One episode row. `title` / `thumbnail` come from AniList streamingEpisodes
 * when available; otherwise the component falls back to "Episode N" and the
 * shared anime artwork.
 */
export type RailEpisode = {
    number: number;
    title?: string;
    thumbnail?: string | null;
    providerCount?: number;
};

type EpisodeRailProps = {
    seasons: WatchSeason[];
    movies: WatchMovie[];
    isMovie: boolean;
    episodes: RailEpisode[];
    currentEpisode: number;
    language: "sub" | "dub";
    animeTitle: string;
    bannerImage: string | null;
    /** Used when an episode has no thumbnail of its own. */
    fallbackThumbnail: string | null;
    nextAiring: NextAiring;
    onSelectEpisode: (episode: number) => void;
    /** Fired once when the airing countdown reaches zero (parent re-fetches). */
    onAiringElapsed?: () => void;
};

function pad(value: number) {
    return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

function SearchIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

function StackIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m12 2 9 5-9 5-9-5 9-5Z" />
            <path d="m3 12 9 5 9-5" />
            <path d="m3 17 9 5 9-5" />
        </svg>
    );
}

function BoltIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
        </svg>
    );
}

const AIRING_FORMAT = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
});

export default function EpisodeRail({
    seasons,
    movies,
    isMovie,
    episodes,
    currentEpisode,
    language,
    animeTitle,
    bannerImage,
    fallbackThumbnail,
    nextAiring,
    onSelectEpisode,
    onAiringElapsed,
}: EpisodeRailProps) {
    const [query, setQuery] = useState("");
    const [nowSeconds, setNowSeconds] = useState(() =>
        Math.floor(Date.now() / 1000)
    );

    useEffect(() => {
        if (!nextAiring) return;

        const id = window.setInterval(() => {
            setNowSeconds(Math.floor(Date.now() / 1000));
        }, 1000);

        return () => window.clearInterval(id);
    }, [nextAiring]);

    const remaining = nextAiring
        ? Math.max(0, nextAiring.airingAt - nowSeconds)
        : null;

    // Tell the parent to re-fetch AniList once the countdown hits zero.
    const elapsed = nextAiring != null && remaining === 0;

    useEffect(() => {
        if (elapsed) onAiringElapsed?.();
    }, [elapsed, onAiringElapsed]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        if (!q) return episodes;

        return episodes.filter(
            (episode) =>
                String(episode.number).includes(q) ||
                `episode ${episode.number}`.includes(q) ||
                (episode.title ?? "").toLowerCase().includes(q)
        );
    }, [episodes, query]);

    const languageLabel =
        language === "dub" ? "English Dub" : "English Sub";

    const showCountdown =
        nextAiring != null && remaining != null && remaining > 0;

    const days = remaining != null ? Math.floor(remaining / 86400) : 0;
    const hours =
        remaining != null ? Math.floor((remaining % 86400) / 3600) : 0;
    const minutes =
        remaining != null ? Math.floor((remaining % 3600) / 60) : 0;
    const seconds = remaining != null ? remaining % 60 : 0;

    const airingLabel =
        nextAiring != null
            ? AIRING_FORMAT.format(
                  new Date(nextAiring.airingAt * 1000)
              )
            : null;

    const sectionHeading = `mb-3 ${watchSectionHeading}`;

    const scrollArea =
        "overflow-y-auto scroll-smooth pr-1 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-white/[0.03] [&::-webkit-scrollbar]:w-1.5";

    return (
        <div className="space-y-4">
            {seasons.length > 0 && (
                <section>
                    <h3 className={sectionHeading}>Seasons</h3>

                    <div className="flex flex-wrap gap-2">
                        {seasons.map((season) =>
                            season.isCurrent ? (
                                <span
                                    key={season.id}
                                    aria-current="true"
                                    title={season.title}
                                    className={watchPill(true, false)}
                                >
                                    {season.label}
                                </span>
                            ) : (
                                <Link
                                    key={season.id}
                                    href={`/anime/${season.id}`}
                                    title={season.title}
                                    className={watchPill(false)}
                                >
                                    {season.label}
                                </Link>
                            )
                        )}
                    </div>
                </section>
            )}

            {showCountdown && (
                <div className="relative overflow-hidden rounded-2xl border border-white/10">
                    {bannerImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={bannerImage}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-40"
                        />
                    )}
                    <div className="absolute inset-0 bg-black/70" />

                    <div className="relative p-3">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Next Airing
                            </span>
                            <span className="font-mono text-[10px] font-bold text-white/50">
                                EP {nextAiring!.episode}
                            </span>
                        </div>

                        {airingLabel && (
                            <p className="mt-1.5 font-mono text-[11px] text-white/55">
                                {airingLabel}
                            </p>
                        )}

                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                            {(
                                [
                                    ["DAYS", days],
                                    ["HRS", hours],
                                    ["MIN", minutes],
                                    ["SEC", seconds],
                                ] as const
                            ).map(([label, value]) => (
                                <div
                                    key={label}
                                    className="rounded-lg bg-black/50 py-1.5 text-center"
                                >
                                    <div className="font-mono text-[15px] font-bold leading-none text-white">
                                        {pad(value)}
                                    </div>
                                    <div className="mt-1 font-mono text-[8px] tracking-[0.15em] text-white/35">
                                        {label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <section>
                <h3 className={sectionHeading}>Episodes</h3>

                {isMovie ? (
                    <div className="relative overflow-hidden rounded-xl border border-white/45 bg-white/[0.07]">
                        {(fallbackThumbnail || bannerImage) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={
                                    (fallbackThumbnail ??
                                        bannerImage) as string
                                }
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover opacity-30"
                            />
                        )}
                        <div className="absolute inset-0 bg-black/60" />
                        <div className="relative p-3">
                            <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wide text-black shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                <BoltIcon className="h-2.5 w-2.5" />
                                Now Playing
                            </span>
                            <p className="mt-1.5 truncate font-mono text-[12px] font-bold text-white">
                                {animeTitle}
                            </p>
                            <p className="mt-1 font-mono text-[10px]">
                                <span className="text-white/40">
                                    Full Movie
                                </span>
                                <span className="text-white/25">{" · "}</span>
                                <span className="font-semibold text-white/85">
                                    {languageLabel}
                                </span>
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="relative mb-2.5">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                                <SearchIcon />
                            </span>

                            <input
                                type="text"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search episodes ..."
                                aria-label="Search episodes"
                                className={watchSearchInput}
                            />
                        </div>

                        <div
                            className={`max-h-[60vh] space-y-2 ${scrollArea}`}
                        >
                            {filtered.length === 0 ? (
                                <p className="py-6 text-center font-mono text-[11px] text-white/35">
                                    No episodes match “{query}”.
                                </p>
                            ) : (
                                filtered.map((episode) => {
                                    const isCurrent =
                                        episode.number ===
                                        currentEpisode;
                                    const thumb =
                                        episode.thumbnail ??
                                        fallbackThumbnail;
                                    const providerCount =
                                        episode.providerCount ?? 0;
                                    const heading = episode.title
                                        ? `Episode ${episode.number} - ${episode.title}`
                                        : `Episode ${episode.number}`;

                                    return (
                                        <button
                                            key={episode.number}
                                            type="button"
                                            onClick={() =>
                                                onSelectEpisode(
                                                    episode.number
                                                )
                                            }
                                            aria-current={isCurrent}
                                            className={`group/ep relative flex min-h-[74px] w-full cursor-pointer overflow-hidden rounded-xl border text-left transition-all duration-200 hover:-translate-y-0.5 ${
                                                isCurrent
                                                    ? "border-white/70 ring-1 ring-white/25 shadow-[0_0_16px_rgba(255,255,255,0.1)]"
                                                    : "border-white/10 hover:border-white/40"
                                            }`}
                                        >
                                            {thumb && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={thumb}
                                                    alt=""
                                                    className="absolute inset-0 h-full w-full object-cover brightness-105 saturate-[1.08] transition duration-300 group-hover/ep:scale-[1.04] group-hover/ep:brightness-125"
                                                />
                                            )}
                                            {/* Readability gradient, kept to the text side so the scene stays bright */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
                                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
                                            {isCurrent && (
                                                <div className="absolute inset-0 bg-white/[0.04]" />
                                            )}

                                            <div className="relative flex w-full items-start justify-between gap-2 p-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-mono text-[12px] font-bold leading-tight text-white">
                                                        {heading}
                                                    </p>

                                                    <p className="mt-1 truncate font-mono text-[10px]">
                                                        <span className="text-white/40">
                                                            Episode{" "}
                                                            {episode.number}
                                                        </span>
                                                        <span className="text-white/25">
                                                            {" · "}
                                                        </span>
                                                        <span className="font-semibold text-white/85">
                                                            {languageLabel}
                                                        </span>
                                                    </p>

                                                    {episode.title && (
                                                        <p className="mt-0.5 truncate font-mono text-[10px] text-white/40">
                                                            {episode.title}
                                                        </p>
                                                    )}

                                                    {(isCurrent ||
                                                        providerCount >
                                                            0) && (
                                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                                            {isCurrent && (
                                                                <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wide text-black shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                                                    <BoltIcon className="h-2.5 w-2.5" />
                                                                    Now Playing
                                                                </span>
                                                            )}
                                                            {providerCount >
                                                                0 && (
                                                                <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/[0.09] px-1.5 py-px font-mono text-[9px] font-medium text-white/70">
                                                                    <StackIcon className="h-2.5 w-2.5" />
                                                                    {
                                                                        providerCount
                                                                    }{" "}
                                                                    {providerCount ===
                                                                    1
                                                                        ? "Provider"
                                                                        : "Providers"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <span className="shrink-0 rounded border border-white/15 bg-black/50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/90 backdrop-blur-sm">
                                                    EP {episode.number}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </section>

            {movies.length > 0 && (
                <section>
                    <h3 className={sectionHeading}>Movies</h3>

                    <div className={`max-h-[40vh] space-y-2 ${scrollArea}`}>
                        {movies.map((movie) => (
                            <Link
                                key={movie.id}
                                href={`/anime/${movie.id}`}
                                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 transition hover:border-white/20 hover:bg-white/[0.045]"
                            >
                                <div className="aspect-[2/3] w-10 shrink-0 overflow-hidden rounded bg-white/5">
                                    {movie.poster && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={movie.poster}
                                            alt=""
                                            className="h-full w-full object-cover"
                                        />
                                    )}
                                </div>

                                <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-medium text-white/85">
                                    {movie.title}
                                </span>

                                <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wide text-white/45">
                                    Movie
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
