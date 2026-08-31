"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import VideoPlayer from "../../../components/VideoPlayer";
import EpisodeRail, {
    type RailEpisode,
} from "../../../components/EpisodeRail";
import AnimeNavbar from "../../../components/AnimeNavbar";
import {
    buildWatchStructure,
    type Anime,
} from "../../../data/anime";
import {
    watchMutedLabel,
    watchPill,
    watchSectionHeading,
} from "../../../components/watchUi";
import type { VideoSource } from "../../../lib/providers/types";
import {
    getWatchProgress,
    recordWatchProgress,
    type WatchProgressInput,
} from "../../../lib/watchProgress";
import { useAuthUser } from "../../../lib/useAuthUser";

type AudioType = "sub" | "dub";

type WatchProvider = {
    id: string;
    name: string;
};

type WatchResponse = {
    animeId: string;
    episode: number;
    type: AudioType;
    selectedProvider?: WatchProvider;
    providers?: WatchProvider[];
    sources: VideoSource[];
    error?: string;
};

type ProgressSnapshot = WatchProgressInput & { uid: string };

const AUDIO_TYPES: AudioType[] = ["sub", "dub"];

function Chevron({
    direction,
}: {
    direction: "left" | "right";
}) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {direction === "left" ? (
                <path d="m15 18-6-6 6-6" />
            ) : (
                <path d="m9 18 6-6-6-6" />
            )}
        </svg>
    );
}

export default function WatchPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const animeId = String(params.id);
    const episode = Number(searchParams.get("episode") ?? "1");
    const type: AudioType =
        searchParams.get("type") === "dub" ? "dub" : "sub";

    const provider = searchParams.get("provider");
    const selectedProvider = provider;
    const router = useRouter();
    const { user, loading: authLoading } = useAuthUser();

    const [source, setSource] = useState<VideoSource | null>(null);
    const [providerList, setProviderList] = useState<WatchProvider[]>(
        []
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    type EpisodeImage = {
        title: string | null;
        thumbnail: string | null;
    };

    const [anime, setAnime] = useState<Anime | null>(null);
    const [airingRefreshKey, setAiringRefreshKey] = useState(0);
    const [tmdbEpisodes, setTmdbEpisodes] = useState<{
        animeId: string;
        map: Map<number, EpisodeImage>;
    } | null>(null);

    useEffect(() => {
        if (!provider) {
            window.location.replace(`/anime/${animeId}`);
        }
    }, [provider, animeId]);

    useEffect(() => {
        if (!selectedProvider) {
            return;
        }

        const providerId = selectedProvider;

        let cancelled = false;

        async function loadSource() {
            setLoading(true);
            setError(null);
            setSource(null);

            try {
                const providerQuery = `&provider=${encodeURIComponent(providerId)}`;

                const response = await fetch(
                    `/api/anime/watch?id=${encodeURIComponent(
                        animeId
                    )}&episode=${episode}&type=${type}${providerQuery}`
                );

                const data: WatchResponse = await response.json();

                if (!cancelled && data.providers) {
                    setProviderList(data.providers);
                }

                if (!response.ok) {
                    throw new Error(
                        data.error || "Failed to load episode"
                    );
                }

                const firstSource = data.sources?.[0];

                if (!firstSource) {
                    throw new Error(
                        `No ${type.toUpperCase()} source available for this episode`
                    );
                }

                if (!cancelled) {
                    setSource(firstSource);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load episode"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        if (
            animeId &&
            Number.isInteger(episode) &&
            episode > 0 &&
            AUDIO_TYPES.includes(type)
        ) {
            loadSource();
        } else {
            setError("Invalid episode information");
            setLoading(false);
        }

        return () => {
            cancelled = true;
        };
    }, [animeId, episode, type, selectedProvider]);

    // Surrounding watch-page UI (title, seasons, episodes, airing) comes from
    // the existing anime-detail endpoint. Playback does not depend on it.
    // Re-fetched when the airing countdown elapses (airingRefreshKey).
    useEffect(() => {
        if (!animeId) return;

        let cancelled = false;

        fetch(`/api/anime/${encodeURIComponent(animeId)}`)
            .then((response) =>
                response.ok ? response.json() : null
            )
            .then((data: Anime | { error: string } | null) => {
                if (!cancelled && data && !("error" in data)) {
                    setAnime(data);
                }
            })
            .catch(() => {
                /* non-critical — the player still works without it */
            });

        return () => {
            cancelled = true;
        };
    }, [animeId, airingRefreshKey]);

    // Single normalization pass: real TV seasons, movies, episode count.
    const structure = useMemo(
        () => (anime ? buildWatchStructure(anime) : null),
        [anime]
    );

    const isMovie = structure?.currentIsMovie ?? false;

    // Episode-specific stills/titles from TMDB. Only applied when the entry
    // we're watching is the first TV season, where AniList episode N maps
    // cleanly onto TMDB's absolute episode N (later seasons of a franchise
    // have an unknown offset, so we leave those to streamingEpisodes).
    const canMapTmdb =
        structure != null &&
        !structure.currentIsMovie &&
        structure.currentSeasonNumber === 1 &&
        !!anime?.title;

    useEffect(() => {
        if (!canMapTmdb || !anime?.title) return;

        let cancelled = false;
        const params = new URLSearchParams({ title: anime.title });
        if (anime.year) params.set("year", String(anime.year));

        fetch(
            `/api/anime/${encodeURIComponent(
                animeId
            )}/episodes?${params.toString()}`
        )
            .then((response) =>
                response.ok ? response.json() : null
            )
            .then(
                (
                    data: {
                        episodes?: ({ number: number } & EpisodeImage)[];
                    } | null
                ) => {
                    if (cancelled || !data?.episodes) return;

                    const map = new Map<number, EpisodeImage>();

                    for (const entry of data.episodes) {
                        if (!map.has(entry.number)) {
                            map.set(entry.number, {
                                title: entry.title,
                                thumbnail: entry.thumbnail,
                            });
                        }
                    }

                    setTmdbEpisodes({ animeId, map });
                }
            )
            .catch(() => {
                /* non-critical — falls back to anime artwork */
            });

        return () => {
            cancelled = true;
        };
    }, [animeId, anime?.title, anime?.year, canMapTmdb]);

    const episodeCount = useMemo(() => {
        if (isMovie) return 1;
        return Math.max(structure?.episodeCount ?? 0, episode, 1);
    }, [isMovie, structure, episode]);

    // Merge AniList streamingEpisodes (title + thumbnail) into the list.
    const episodeMeta = useMemo(() => {
        const map = new Map<
            number,
            { title: string; thumbnail: string | null }
        >();

        for (const entry of anime?.streamingEpisodes ?? []) {
            if (!map.has(entry.number)) {
                map.set(entry.number, {
                    title: entry.title,
                    thumbnail: entry.thumbnail,
                });
            }
        }

        return map;
    }, [anime]);

    const tmdbMap =
        tmdbEpisodes?.animeId === animeId
            ? tmdbEpisodes.map
            : null;

    const railEpisodes = useMemo<RailEpisode[]>(
        () =>
            Array.from({ length: episodeCount }, (_, index) => {
                const number = index + 1;
                const meta = episodeMeta.get(number);
                const tmdb = tmdbMap?.get(number);

                return {
                    number,
                    // Prefer the fansite-style AniList title, then TMDB's.
                    title: meta?.title ?? tmdb?.title ?? undefined,
                    // Prefer the TMDB still (consistent per-episode frame),
                    // then the AniList thumbnail.
                    thumbnail:
                        tmdb?.thumbnail ?? meta?.thumbnail ?? null,
                    providerCount: providerList.length || 1,
                };
            }),
        [episodeCount, episodeMeta, tmdbMap, providerList.length]
    );

    const pushWatch = useCallback(
        (next: {
            episode?: number;
            type?: AudioType;
            provider?: string;
        }) => {
            const query = new URLSearchParams();
            query.set("episode", String(next.episode ?? episode));
            query.set("type", next.type ?? type);
            const nextProvider = next.provider ?? provider;
            if (nextProvider) query.set("provider", nextProvider);

            router.push(
                `/anime/${animeId}/watch?${query.toString()}`
            );
        },
        [animeId, episode, type, provider, router]
    );

    const goToEpisode = useCallback(
        (next: number) => {
            if (next < 1 || next === episode) return;
            pushWatch({ episode: next });
        },
        [episode, pushWatch]
    );

    const goToType = useCallback(
        (next: AudioType) => {
            if (next === type) return;
            pushWatch({ type: next });
        },
        [type, pushWatch]
    );

    const goToProvider = useCallback(
        (next: string) => {
            if (next === provider) return;
            pushWatch({ provider: next });
        },
        [provider, pushWatch]
    );

    const onAiringElapsed = useCallback(() => {
        setAiringRefreshKey((key) => key + 1);
    }, []);

    const hasPrev = !isMovie && episode > 1;
    const hasNext = !isMovie && episode < episodeCount;

    const posterForPlayer = anime?.banner ?? anime?.poster ?? null;
    const railThumbnail = anime?.poster ?? anime?.banner ?? null;
    const seasonNumber = structure?.currentSeasonNumber ?? 1;

    const progressIdentity = `${animeId}:${seasonNumber}:${episode}`;
    const resumeIdentity = `${user?.uid ?? "signed-out"}:${progressIdentity}`;
    const [resumeState, setResumeState] = useState<{
        key: string;
        position: number | null;
    }>({ key: "", position: null });
    const latestProgressRef = useRef<ProgressSnapshot | null>(null);
    const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressWriteChainRef = useRef(Promise.resolve());
    if (resumeState.key !== resumeIdentity) {
        setResumeState({ key: resumeIdentity, position: null });
    }

    const progressContext = useMemo(
        () =>
            user && anime && Number.isInteger(episode) && episode > 0
                ? {
                      uid: user.uid,
                      animeId: anime.id,
                      title: anime.title,
                      poster: anime.poster,
                      season: seasonNumber,
                      episode,
                  }
                : null,
        [anime, episode, seasonNumber, user]
    );

    const enqueueProgressWrite = useCallback((snapshot: ProgressSnapshot) => {
        progressWriteChainRef.current = progressWriteChainRef.current
            .catch(() => undefined)
            .then(() =>
                recordWatchProgress(snapshot.uid, {
                    animeId: snapshot.animeId,
                    title: snapshot.title,
                    poster: snapshot.poster,
                    season: snapshot.season,
                    episode: snapshot.episode,
                    currentTime: snapshot.currentTime,
                    duration: snapshot.duration,
                })
            );
    }, []);

    const flushProgress = useCallback(() => {
        if (progressTimerRef.current) {
            clearTimeout(progressTimerRef.current);
            progressTimerRef.current = null;
        }

        const snapshot = latestProgressRef.current;
        if (snapshot) {
            latestProgressRef.current = null;
            enqueueProgressWrite(snapshot);
        }
    }, [enqueueProgressWrite]);

    const queueProgress = useCallback(
        (currentTime: number, duration: number) => {
            const context = progressContext;
            if (
                !context ||
                !Number.isFinite(currentTime) ||
                currentTime < 0 ||
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }

            latestProgressRef.current = {
                ...context,
                currentTime,
                duration,
            };

            if (!progressTimerRef.current) {
                progressTimerRef.current = setTimeout(() => {
                    progressTimerRef.current = null;
                    flushProgress();
                }, 5_000);
            }
        },
        [flushProgress, progressContext]
    );

    const saveProgressNow = useCallback(
        (currentTime: number, duration: number) => {
            queueProgress(currentTime, duration);
            flushProgress();
        },
        [flushProgress, queueProgress]
    );

    useEffect(() => {
        if (
            authLoading ||
            !user ||
            !anime ||
            !Number.isInteger(episode) ||
            episode < 1
        ) {
            return;
        }

        let cancelled = false;

        getWatchProgress(user.uid, anime.id)
            .then((progress) => {
                if (cancelled) return;

                const sameEpisode =
                    progress?.season === seasonNumber &&
                    progress.episode === episode;
                const savedPosition = progress?.currentTime;
                const savedDuration = progress?.duration;
                const validPosition =
                    sameEpisode &&
                    savedPosition !== null &&
                    savedPosition !== undefined &&
                    Number.isFinite(savedPosition) &&
                    savedPosition >= 0 &&
                    (!savedDuration ||
                        (savedPosition < savedDuration &&
                            savedDuration - savedPosition > 10));

                setResumeState({
                    key: resumeIdentity,
                    position: validPosition ? savedPosition : null,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setResumeState({ key: resumeIdentity, position: null });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [anime, authLoading, episode, resumeIdentity, seasonNumber, user]);

    useEffect(() => {
        return () => flushProgress();
    }, [flushProgress, progressIdentity]);

    useEffect(() => {
        const handlePageHide = () => flushProgress();
        window.addEventListener("pagehide", handlePageHide);
        return () => window.removeEventListener("pagehide", handlePageHide);
    }, [flushProgress]);

    const resumeTime =
        resumeState.key === resumeIdentity ? resumeState.position : null;

    const handlePlaybackReady = useCallback(
        (duration: number) => queueProgress(0, duration),
        [queueProgress]
    );
    const handlePlaybackTimeUpdate = useCallback(
        (currentTime: number, duration: number) => queueProgress(currentTime, duration),
        [queueProgress]
    );
    const handlePlaybackPause = useCallback(
        (currentTime: number, duration: number) => saveProgressNow(currentTime, duration),
        [saveProgressNow]
    );

    const servers: WatchProvider[] =
        providerList.length > 0
            ? providerList
            : selectedProvider
            ? [
                  {
                      id: selectedProvider,
                      name:
                          selectedProvider === "megaplay"
                              ? "MegaPlay"
                              : selectedProvider,
                  },
              ]
            : [];

    const crumbButton =
        "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/12 bg-white/[0.03] text-white/55 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-white/12 disabled:hover:text-white/55";

    const pill = (active: boolean) => watchPill(active);

    const navButton =
        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 font-mono text-xs font-medium text-white/75 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-white/75";

    return (
        <main className="min-h-screen bg-black pb-24 pt-4 text-white">
            <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8">
                {/* Breadcrumb / episode nav */}
                <div className="flex items-center gap-2 pb-2 pt-3 text-sm">
                    <button
                        type="button"
                        onClick={() => goToEpisode(episode - 1)}
                        disabled={!hasPrev}
                        aria-label="Previous episode"
                        className={crumbButton}
                    >
                        <Chevron direction="left" />
                    </button>

                    <Link
                        href={`/anime/${animeId}`}
                        className="min-w-0 max-w-[52vw] truncate font-mono text-[13px] text-white/60 transition hover:text-white sm:max-w-none"
                    >
                        {anime?.title ?? "Loading…"}
                    </Link>

                    <span className="font-mono text-[13px] text-white/25">
                        /
                    </span>

                    <span className="whitespace-nowrap font-mono text-[13px] font-bold text-white">
                        {isMovie
                            ? "Movie"
                            : `S${seasonNumber} E${episode}`}
                    </span>

                    <button
                        type="button"
                        onClick={() => goToEpisode(episode + 1)}
                        disabled={!hasNext}
                        aria-label="Next episode"
                        className={crumbButton}
                    >
                        <Chevron direction="right" />
                    </button>
                </div>

                {/* Main grid — desktop: ~2/3 player, ~1/3 episode sidebar.
                    The sidebar stays a narrow fixed column; the player fills
                    whatever's left (never the full width). */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
                    {/* LEFT */}
                    <div className="min-w-0">
                        <VideoPlayer
                            src={source?.url ?? null}
                            sourceKind={source?.kind ?? "iframe"}
                            isHLS={source?.isHLS}
                            language={type}
                            poster={posterForPlayer}
                            subtitles={source?.subtitles}
                            title={
                                isMovie
                                    ? anime?.title
                                    : `Episode ${episode}`
                            }
                            loading={loading}
                            error={error}
                            onPreviousEpisode={hasPrev ? () => goToEpisode(episode - 1) : undefined}
                            onNextEpisode={hasNext ? () => goToEpisode(episode + 1) : undefined}
                            resumeTime={resumeTime}
                            onPlaybackReady={handlePlaybackReady}
                            onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
                            onPlaybackPause={handlePlaybackPause}
                        />

                        {error && (
                            <div className="mt-3 text-center">
                                <Link
                                    href={`/anime/${animeId}`}
                                    className="inline-block rounded-md border border-white/12 px-3.5 py-1.5 font-mono text-[11px] text-white/60 transition hover:border-white/30 hover:text-white"
                                >
                                    Back to anime
                                </Link>
                            </div>
                        )}

                        {/* Video hosts / language / server */}
                        <section className="mt-4 space-y-3">
                            <h3 className={watchSectionHeading}>
                                Video Hosts
                            </h3>

                            {/* Language + server stay on one line from `sm` up
                                (reference layout); wrap only on the narrowest
                                screens. */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => goToType("sub")}
                                        aria-pressed={type === "sub"}
                                        className={pill(type === "sub")}
                                    >
                                        English Sub
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => goToType("dub")}
                                        aria-pressed={type === "dub"}
                                        className={pill(type === "dub")}
                                    >
                                        English Dub
                                    </button>
                                </div>

                                {servers.length > 0 && (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="hidden h-5 w-px shrink-0 bg-white/15 sm:block"
                                        />

                                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap">
                                            <span
                                                className={`mr-0.5 shrink-0 ${watchMutedLabel}`}
                                            >
                                                Server
                                            </span>

                                            {servers.map((server) => (
                                                <button
                                                    key={server.id}
                                                    type="button"
                                                    onClick={() =>
                                                        goToProvider(
                                                            server.id
                                                        )
                                                    }
                                                    aria-pressed={
                                                        server.id ===
                                                        selectedProvider
                                                    }
                                                    className={`shrink-0 ${pill(
                                                        server.id ===
                                                            selectedProvider
                                                    )}`}
                                                >
                                                    {server.name}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {!isMovie && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            goToEpisode(episode - 1)
                                        }
                                        disabled={!hasPrev}
                                        className={navButton}
                                    >
                                        <Chevron direction="left" />
                                        Previous Episode
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            goToEpisode(episode + 1)
                                        }
                                        disabled={!hasNext}
                                        className={navButton}
                                    >
                                        Next Episode
                                        <Chevron direction="right" />
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* Comments (placeholder — no backend yet) */}
                        <section className="mt-6 border-t border-white/10 pt-5">
                            <h3
                                className={`flex items-center gap-2 ${watchSectionHeading}`}
                            >
                                <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                Comments (0)
                            </h3>

                            <p className="mt-2 font-mono text-[11px] text-white/40">
                                Sign in to leave a comment.
                            </p>

                            <p className="mt-6 text-center font-mono text-[11px] text-white/25">
                                No comments yet. Be the first!
                            </p>
                        </section>
                    </div>

                    {/* RIGHT */}
                    <aside className="min-w-0">
                        <EpisodeRail
                            seasons={structure?.seasons ?? []}
                            movies={structure?.movies ?? []}
                            isMovie={isMovie}
                            episodes={railEpisodes}
                            currentEpisode={episode}
                            language={type}
                            animeTitle={anime?.title ?? ""}
                            bannerImage={
                                anime?.banner ?? anime?.poster ?? null
                            }
                            fallbackThumbnail={railThumbnail}
                            nextAiring={
                                anime?.nextAiringEpisode ?? null
                            }
                            onSelectEpisode={goToEpisode}
                            onAiringElapsed={onAiringElapsed}
                        />
                    </aside>
                </div>
            </div>

            <AnimeNavbar />
        </main>
    );
}
