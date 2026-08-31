"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import PlaybackSurface from "./PlaybackSurface";
import type {
    VideoSourceKind,
    VideoSubtitle,
} from "../lib/providers/types";

/**
 * VideoPlayer — the framed player boundary on the watch page.
 *
 *   VideoPlayer
 *     ├── playback surface   → <PlaybackSurface> (swappable; iframe today)
 *     └── controls layer     → owned by AnimeVerseVideoPlayer for direct media;
 *                              MegaPlay continues drawing controls in its iframe.
 *
 * What this component owns and will keep owning across a playback swap:
 *   - the 16:9 framed container (radius / border / black bg)
 *   - the poster + "tap to start" gate (also defers loading the embed)
 *   - upstream loading / error / no-source states
 *   - page-level fullscreen of the container (Fullscreen API)
 *   - the language badge
 *
 * It deliberately renders NO fake scrubber / play / settings controls over the
 * cross-origin iframe.
 */

const MEGAPLAY_EMBED_BASE = "https://megaplay.buzz/stream/s-2";

export type PlayerLanguage = "sub" | "dub";

/**
 * Build a MegaPlay `s-2` embed URL from an episode embed id + language.
 * Returns null when the embed id is not a plain numeric id.
 *
 *   https://megaplay.buzz/stream/s-2/{episode_embed_id}/{language}
 */
export function buildMegaPlayEmbedUrl(
    embedId: string | number,
    language: PlayerLanguage
): string | null {
    const id = String(embedId ?? "").trim();

    if (!/^\d+$/.test(id)) {
        return null;
    }

    const lang: PlayerLanguage = language === "dub" ? "dub" : "sub";

    return `${MEGAPLAY_EMBED_BASE}/${encodeURIComponent(id)}/${lang}`;
}

type VideoPlayerProps = {
    /**
     * A full, ready-to-embed cross-origin URL resolved by the provider layer
     * (e.g. the MegaPlay source returned from /api/anime/watch). Takes
     * precedence over `embedId` when both are supplied.
     */
    src?: string | null;

    /** How the resolved source should be mounted by PlaybackSurface. */
    sourceKind?: VideoSourceKind;
    isHLS?: boolean;

    /**
     * Alternative to `src`: a MegaPlay episode embed id. Combined with
     * `language` it is turned into an `s-2` embed URL internally.
     */
    embedId?: string | number | null;

    /** Audio language for the embed URL built from `embedId`, and the badge. */
    language?: PlayerLanguage;

    /** Poster shown behind the play gate, before the embed is loaded. */
    poster?: string | null;

    /** Resolver-provided WebVTT-compatible subtitle tracks. */
    subtitles?: VideoSubtitle[];

    /** Short label announced on the play button, e.g. "Episode 5". */
    title?: string;

    /** True while the source is still being resolved upstream. */
    loading?: boolean;

    /** Upstream error message, if the source could not be resolved. */
    error?: string | null;

    /** Episode navigation controls for the direct player surface. */
    onPreviousEpisode?: () => void;
    onNextEpisode?: () => void;
    resumeTime?: number | null;
    onPlaybackReady?: (duration: number) => void;
    onPlaybackTimeUpdate?: (currentTime: number, duration: number) => void;
    onPlaybackPause?: (currentTime: number, duration: number) => void;
};

function PlayIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.79-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
        </svg>
    );
}

function ReloadIcon({ className }: { className?: string }) {
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
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v4h4" />
        </svg>
    );
}

function ExpandIcon({ className }: { className?: string }) {
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
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
        </svg>
    );
}

function CollapseIcon({ className }: { className?: string }) {
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
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m13-5h-3a2 2 0 0 0-2 2v3" />
        </svg>
    );
}

function Spinner({ className }: { className?: string }) {
    return (
        <svg
            className={`animate-spin ${className ?? ""}`}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeWidth="3"
            />
            <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function VideoPlayer({
    src,
    sourceKind = "iframe",
    isHLS = false,
    embedId,
    language = "sub",
    poster,
    subtitles,
    title,
    loading = false,
    error = null,
    onPreviousEpisode,
    onNextEpisode,
    resumeTime,
    onPlaybackReady,
    onPlaybackTimeUpdate,
    onPlaybackPause,
}: VideoPlayerProps) {
    const embedUrl = useMemo(() => {
        const trimmed = src?.trim();

        if (trimmed) {
            return trimmed;
        }

        if (embedId !== null && embedId !== undefined && embedId !== "") {
            return buildMegaPlayEmbedUrl(embedId, language);
        }

        return null;
    }, [src, embedId, language]);

    const containerRef = useRef<HTMLDivElement>(null);

    const [started, setStarted] = useState(false);
    const [frameLoaded, setFrameLoaded] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Reset transient player state when the underlying source changes.
    // (React's "adjust state during render" pattern — no effect needed.)
    const [trackedUrl, setTrackedUrl] = useState(embedUrl);

    if (embedUrl !== trackedUrl) {
        setTrackedUrl(embedUrl);
        setStarted(false);
        setFrameLoaded(false);
        setReloadToken(0);
    }

    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(
                document.fullscreenElement === containerRef.current
            );
        };

        document.addEventListener("fullscreenchange", handleChange);

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleChange
            );
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        const element = containerRef.current;

        if (!element) return;

        // Element Fullscreen API is unavailable on iPhone (handled by the
        // direct player via webkitEnterFullscreen) and on very old browsers —
        // bail gracefully instead of throwing.
        if (
            typeof element.requestFullscreen !== "function" ||
            typeof document.exitFullscreen !== "function"
        ) {
            return;
        }

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {
                /* ignore */
            });
        } else {
            element.requestFullscreen().catch(() => {
                /* ignore */
            });
        }
    }, []);

    const reloadSurface = useCallback(() => {
        setFrameLoaded(false);
        setReloadToken((token) => token + 1);
    }, []);

    const shellClassName = isFullscreen
        ? "group relative w-full h-screen overflow-hidden bg-black"
        : "group relative w-full aspect-video overflow-hidden rounded-xl border border-white/10 bg-black";

    const iconButton =
        "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-black/45 text-white/75 backdrop-blur-md transition hover:border-white/30 hover:bg-black/65 hover:text-white";

    // --- Upstream states ----------------------------------------------------

    if (loading) {
        return (
            <div className={shellClassName} ref={containerRef}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950">
                    <Spinner className="h-7 w-7 text-white/70" />
                    <p className="font-mono text-xs tracking-wide text-white/50">
                        Resolving stream…
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={shellClassName} ref={containerRef}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950 px-6 text-center">
                    <p className="text-sm font-medium text-red-400">
                        {error}
                    </p>
                    <p className="max-w-sm font-mono text-[11px] leading-relaxed text-white/40">
                        This provider may not have this episode.
                    </p>
                </div>
            </div>
        );
    }

    if (!embedUrl) {
        return (
            <div className={shellClassName} ref={containerRef}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950 px-6 text-center">
                    <p className="text-sm text-white/60">
                        No playable source available
                    </p>
                    <p className="font-mono text-[11px] text-white/35">
                        MegaPlay could not resolve this episode.
                    </p>
                </div>
            </div>
        );
    }

    // --- Player -----------------------------------------------------------

    const languageLabel = language === "dub" ? "DUB" : "SUB";

    return (
        <div className={shellClassName} ref={containerRef}>
            {/* Playback surface (swappable) */}
            {started && (
                <PlaybackSurface
                    implementation={sourceKind}
                    url={embedUrl}
                    isHLS={isHLS}
                    title={title}
                    reloadToken={reloadToken}
                    poster={poster}
                    subtitles={subtitles}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                    onReady={() => setFrameLoaded(true)}
                    onPreviousEpisode={onPreviousEpisode}
                    onNextEpisode={onNextEpisode}
                    resumeTime={resumeTime}
                    onPlaybackReady={onPlaybackReady}
                    onPlaybackTimeUpdate={onPlaybackTimeUpdate}
                    onPlaybackPause={onPlaybackPause}
                />
            )}

            {/* Direct sources own their controls; MegaPlay continues to render its controls in the iframe. */}

            {/* Buffering veil while the surface boots */}
            {started && !frameLoaded && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
                    <Spinner className="h-7 w-7 text-white/70" />
                </div>
            )}

            {/* Poster / play gate */}
            {!started && (
                <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center"
                    aria-label={title ? `Play ${title}` : "Play episode"}
                >
                    {poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={poster}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
                    )}

                    <div className="absolute inset-0 bg-black/40 transition group-hover:bg-black/30" />

                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white shadow-lg backdrop-blur-md transition group-hover:scale-105 group-hover:bg-white/25 md:h-16 md:w-16">
                        <PlayIcon className="ml-0.5 h-6 w-6 md:h-7 md:w-7" />
                    </span>
                </button>
            )}

            {/* Language badge */}
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/15 bg-black/45 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/75 backdrop-blur-md">
                {languageLabel}
            </div>

            {/* Real, parent-side actions only */}
            <div
                className={`absolute right-3 top-3 flex items-center gap-1.5 transition ${
                    started
                        ? sourceKind === "iframe"
                            ? "opacity-0 group-hover:opacity-100"
                            : "pointer-events-none opacity-0"
                        : "opacity-100"
                }`}
            >
                {started && sourceKind === "iframe" && (
                    <button
                        type="button"
                        onClick={reloadSurface}
                        aria-label="Reload player"
                        className={iconButton}
                    >
                        <ReloadIcon className="h-4 w-4" />
                    </button>
                )}

                <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={
                        isFullscreen
                            ? "Exit fullscreen"
                            : "Enter fullscreen"
                    }
                    className={iconButton}
                >
                    {isFullscreen ? (
                        <CollapseIcon className="h-4 w-4" />
                    ) : (
                        <ExpandIcon className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    );
}
