"use client";

import Link from "next/link";
import {
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Heart,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AnimeNavbar from "../../components/AnimeNavbar";
import ProviderModal, { PROVIDERS } from "../../components/ProviderModal";

import {
    buildWatchStructure,
    formatScore,
    type Anime,
} from "../../data/anime";
import {
    addFavorite,
    isAnimeFavorited,
    removeFavorite,
} from "../../lib/favorites";
import { recordRecentlyViewed } from "../../lib/recentlyViewed";
import {
    isAnimeSaved,
    saveAnime,
    unsaveAnime,
} from "../../lib/saved";
import { getWatchProgress } from "../../lib/watchProgress";
import { useAuthUser } from "../../lib/useAuthUser";

const EPISODE_PAGE_SIZE = 9;

function formatTimeLeft(seconds: number) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
}

const RELATION_LABELS: Record<string, string> = {
    ADAPTATION: "Adaptation",
    PREQUEL: "Prequel",
    SEQUEL: "Sequel",
    PARENT: "Parent",
    SIDE_STORY: "Side Story",
    CHARACTER: "Character",
    SUMMARY: "Summary",
    ALTERNATIVE: "Alternative",
    SPIN_OFF: "Spin Off",
    SOURCE: "Source",
    COMPILATION: "Compilation",
    CONTAINS: "Contains",
    OTHER: "Other",
};

function formatRelationType(relationType: string) {
    return (
        RELATION_LABELS[relationType] ??
        relationType
            .toLowerCase()
            .split("_")
            .filter(Boolean)
            .map(
                (word) =>
                    word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join(" ")
    );
}

export default function AnimeDetailPage() {
    const params = useParams();
    const router = useRouter();

    const id = params.id as string;

    const [anime, setAnime] = useState<Anime | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const [showProviderModal, setShowProviderModal] = useState(false);
    const [selectedProvider, setSelectedProvider] =
        useState<string>("megaplay");

    const [favoriteState, setFavoriteState] = useState<{
        key: string | null;
        value: boolean;
    }>({ key: null, value: false });
    const [favoritePending, setFavoritePending] = useState(false);
    const [savedState, setSavedState] = useState<{
        key: string | null;
        value: boolean;
    }>({ key: null, value: false });
    const [savedPending, setSavedPending] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<
        "overview" | "episodes" | "more"
    >("overview");
    const [visibleEpisodeCount, setVisibleEpisodeCount] =
        useState(EPISODE_PAGE_SIZE);
    const [selectedEpisode, setSelectedEpisode] = useState(1);
    const [watchProgressState, setWatchProgressState] = useState<{
        key: string | null;
        episode: number | null;
    }>({ key: null, episode: null });
    const [tmdbEpisodes, setTmdbEpisodes] = useState<{
        animeId: string;
        /** TMDB metadata keyed by ABSOLUTE (franchise-wide) episode number. */
        map: Map<number, { title: string | null; thumbnail: string | null }>;
        /** Highest absolute episode number TMDB returned for the franchise. */
        total: number;
    } | null>(null);
    const { user, loading: authLoading } = useAuthUser();

    const showToast = useCallback((message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(null), 2200);
    }, []);

    // Franchise season count. The detail API walks the full AniList
    // prequel/sequel chain and returns `totalSeasons`; fall back to the
    // 1-hop client calculation only if that field is missing.
    const totalSeasons = useMemo(() => {
        if (!anime) return null;
        return (
            anime.totalSeasons ??
            Math.max(1, buildWatchStructure(anime).seasons.length)
        );
    }, [anime]);

    const watchStructure = useMemo(
        () => (anime ? buildWatchStructure(anime) : null),
        [anime]
    );

    // Per-episode stills / titles come from the same TMDB endpoint the watch
    // page uses. Fetch for any episodic entry that has a title (movies have
    // no episode list); the season → absolute-number mapping is handled in
    // `detailEpisodes` below.
    const canFetchEpisodes =
        !!anime?.title &&
        watchStructure != null &&
        !watchStructure.currentIsMovie;

    useEffect(() => {
        if (!id || !canFetchEpisodes || !anime?.title) return;

        let cancelled = false;
        const query = new URLSearchParams({ title: anime.title });
        if (anime.year) query.set("year", String(anime.year));

        fetch(
            `/api/anime/${encodeURIComponent(id)}/episodes?${query.toString()}`
        )
            .then((response) => (response.ok ? response.json() : null))
            .then(
                (
                    data: {
                        episodes?: {
                            number: number;
                            title: string | null;
                            thumbnail: string | null;
                        }[];
                    } | null
                ) => {
                    if (cancelled || !data?.episodes) return;

                    const map = new Map<
                        number,
                        { title: string | null; thumbnail: string | null }
                    >();
                    let total = 0;

                    for (const entry of data.episodes) {
                        total = Math.max(total, entry.number);
                        if (!map.has(entry.number)) {
                            map.set(entry.number, {
                                title: entry.title,
                                thumbnail: entry.thumbnail,
                            });
                        }
                    }

                    setTmdbEpisodes({ animeId: id, map, total });
                }
            )
            .catch(() => {
                /* non-critical — falls back to AniList data / artwork */
            });

        return () => {
            cancelled = true;
        };
    }, [id, anime?.title, anime?.year, canFetchEpisodes]);

    const detailEpisodes = useMemo(() => {
        if (!anime || !watchStructure || watchStructure.currentIsMovie) {
            return [];
        }

        // This entry's own episode list: 1..N local numbers, sized the same
        // way the watch page sizes it. Watch links use these local numbers.
        const localCount = watchStructure.episodeCount;

        const metadata = new Map(
            anime.streamingEpisodes.map((episode) => [
                episode.number,
                episode,
            ])
        );
        const tmdb =
            tmdbEpisodes?.animeId === anime.id ? tmdbEpisodes : null;

        // AniList `streamingEpisodes` and TMDB both number episodes ABSOLUTELY
        // across the whole franchise, while this page shows one season's local
        // 1..N. Work out how many franchise episodes precede this season so the
        // two line up — but only when we can pin it with confidence, so a card
        // never shows another season's title.
        const seasons = watchStructure.seasons;
        let absoluteOffset: number | null = tmdb ? 0 : null;

        if (tmdb && seasons.length > 1) {
            const currentIndex = Math.max(
                0,
                seasons.findIndex((season) => season.isCurrent)
            );
            const sumEps = (list: typeof seasons) =>
                list.reduce(
                    (sum, season) => sum + (season.episodeCount ?? 0),
                    0
                );
            const before = sumEps(seasons.slice(0, currentIndex));
            const after = sumEps(seasons.slice(currentIndex + 1));

            if (
                currentIndex === 0 &&
                watchStructure.currentSeasonNumber <= 1
            ) {
                absoluteOffset = 0; // genuine first season
            } else if (before + localCount + after === tmdb.total) {
                absoluteOffset = before; // chain covers every season → exact
            } else if (
                after === 0 &&
                tmdb.total - localCount >= before
            ) {
                absoluteOffset = tmdb.total - localCount; // newest season = tail
            } else {
                absoluteOffset = null; // can't place it — skip TMDB
            }
        } else if (
            tmdb &&
            seasons.length <= 1 &&
            watchStructure.currentSeasonNumber > 1
        ) {
            // Titled as a later season but AniList gave us no prequel chain.
            absoluteOffset = null;
        }

        return Array.from({ length: localCount }, (_, index) => {
            const number = index + 1;
            const key = number + (absoluteOffset ?? 0);
            const entry = metadata.get(key);
            const still =
                absoluteOffset != null ? tmdb?.map.get(key) : undefined;
            const stillTitle =
                still?.title &&
                !/^episode\s+\d+$/i.test(still.title.trim())
                    ? still.title
                    : null;

            return {
                number,
                // Real title only: AniList streaming listing, then TMDB, else
                // null → the card shows "Episode N".
                title: entry?.title ?? stillTitle ?? null,
                // Episode-specific still first, then the AniList thumbnail,
                // then the anime artwork so the card never breaks.
                thumbnail:
                    still?.thumbnail ||
                    entry?.thumbnail ||
                    anime.banner ||
                    anime.poster,
            };
        });
    }, [anime, watchStructure, tmdbEpisodes]);

    const episodeTotal = detailEpisodes.length;
    const visibleEpisodes = detailEpisodes.slice(0, visibleEpisodeCount);
    const canLoadMoreEpisodes = visibleEpisodeCount < episodeTotal;
    const canShowLessEpisodes =
        visibleEpisodeCount > EPISODE_PAGE_SIZE &&
        visibleEpisodes.length > EPISODE_PAGE_SIZE;

    useEffect(() => {
        if (authLoading || !anime) return;

        if (!user) {
            return;
        }

        let cancelled = false;
        const key = `${user.uid}:${anime.id}`;

        isAnimeSaved(user.uid, anime.id)
            .then((value) => {
                if (!cancelled) setSavedState({ key, value });
            })
            .catch((error) => {
                if (!cancelled && process.env.NODE_ENV !== "production") {
                    console.error("Failed to check saved anime:", error);
                }
                if (!cancelled) setSavedState({ key, value: false });
            });

        return () => {
            cancelled = true;
        };
    }, [anime, authLoading, user]);

    const savedKey = user && anime ? `${user.uid}:${anime.id}` : null;
    const savedLoading =
        authLoading ||
        (savedKey !== null && savedState.key !== savedKey);
    const saved =
        savedKey !== null &&
        savedState.key === savedKey &&
        savedState.value;

    useEffect(() => {
        if (authLoading || !anime || !user) return;

        let cancelled = false;
        const key = `${user.uid}:${anime.id}`;

        getWatchProgress(user.uid, anime.id)
            .then((progress) => {
                if (!cancelled) {
                    setWatchProgressState({
                        key,
                        episode: progress?.episode ?? null,
                    });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setWatchProgressState({ key, episode: null });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [anime, authLoading, user]);

    const watchProgressKey = user && anime ? `${user.uid}:${anime.id}` : null;
    const continueEpisode =
        watchProgressKey !== null && watchProgressState.key === watchProgressKey
            ? watchProgressState.episode
            : null;

    useEffect(() => {
        if (authLoading || !anime || !user) return;

        let cancelled = false;
        const key = `${user.uid}:${anime.id}`;

        isAnimeFavorited(user.uid, anime.id)
            .then((value) => {
                if (!cancelled) setFavoriteState({ key, value });
            })
            .catch((error) => {
                if (!cancelled && process.env.NODE_ENV !== "production") {
                    console.error("Failed to check favorite anime:", error);
                }
                if (!cancelled) setFavoriteState({ key, value: false });
            });

        return () => {
            cancelled = true;
        };
    }, [anime, authLoading, user]);

    const favoriteKey = user && anime ? `${user.uid}:${anime.id}` : null;
    const favoriteLoading =
        authLoading ||
        (favoriteKey !== null && favoriteState.key !== favoriteKey);
    const favorite =
        favoriteKey !== null &&
        favoriteState.key === favoriteKey &&
        favoriteState.value;

    const toggleFavorite = async () => {
        if (favoritePending || favoriteLoading || authLoading || !anime) {
            return;
        }

        if (!user) {
            router.push("/auth");
            return;
        }

        setFavoritePending(true);
        const wasFavorite = favorite;

        try {
            if (wasFavorite) {
                await removeFavorite(user.uid, anime.id);
                setFavoriteState({ key: favoriteKey, value: false });
                showToast("Removed from Favorites");
            } else {
                await addFavorite(user.uid, {
                    animeId: anime.id,
                    title: anime.title,
                    poster: anime.poster,
                });
                setFavoriteState({ key: favoriteKey, value: true });
                showToast("Added to Favorites");
            }
        } catch (error) {
            if (process.env.NODE_ENV !== "production") {
                console.error("Failed to update favorite anime:", error);
            }
            showToast("Couldn\u2019t update Favorites");
        } finally {
            setFavoritePending(false);
        }
    };

    const toggleSaved = async () => {
        if (savedPending || savedLoading || authLoading || !anime) return;

        if (!user) {
            router.push("/auth");
            return;
        }

        setSavedPending(true);
        const wasSaved = saved;

        try {
            if (wasSaved) {
                await unsaveAnime(user.uid, anime.id);
                setSavedState({ key: savedKey, value: false });
                showToast("Removed from Saved");
            } else {
                await saveAnime(user.uid, {
                    animeId: anime.id,
                    title: anime.title,
                    poster: anime.poster,
                });
                setSavedState({ key: savedKey, value: true });
                showToast("Added to Saved");
            }
        } catch (error) {
            if (process.env.NODE_ENV !== "production") {
                console.error("Failed to update saved anime:", error);
            }
            showToast("Couldn\u2019t update Saved");
        } finally {
            setSavedPending(false);
        }
    };

    const shareAnime = async () => {
        const url = window.location.href;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: anime?.title,
                    text: anime
                        ? `Watch ${anime.title} on AnimeVerse`
                        : undefined,
                    url,
                });
                return;
            } catch {
                // user cancelled the share sheet — fall through to copy
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            showToast("Link copied to clipboard");
        } catch {
            showToast("Couldn't copy the link");
        }
    };

    useEffect(() => {
        if (!id) return;

        const loadAnime = async () => {
            try {
                const response = await fetch(`/api/anime/${id}`);

                if (!response.ok) {
                    throw new Error("Failed to fetch anime");
                }

                const data: Anime = await response.json();
                setAnime(data);
            } catch (error) {
                console.error("Failed to load anime:", error);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        loadAnime();
    }, [id]);

    // Record this anime in the signed-in user's "Recently Viewed" list once its
    // detail data is available. Fire-and-forget — it never blocks or breaks the
    // page, does nothing when signed out, and the ref keeps React Strict Mode's
    // double-invoke (and any re-render) to a single Firestore write per anime.
    const recordedIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (!anime || recordedIdRef.current === anime.id) return;
        recordedIdRef.current = anime.id;

        void recordRecentlyViewed({
            animeId: anime.id,
            title: anime.title,
            poster: anime.poster,
        });
    }, [anime]);

    // Clear the countdown when the current title has no upcoming episode — the
    // same reset the airing effect used to do inline, moved to an
    // adjust-state-during-render check so it isn't a synchronous setState in an
    // effect.
    const hasAiring = Boolean(anime?.nextAiringEpisode);
    const [trackedHasAiring, setTrackedHasAiring] = useState(false);
    if (hasAiring !== trackedHasAiring) {
        setTrackedHasAiring(hasAiring);
        if (!hasAiring) setTimeLeft(null);
    }

    useEffect(() => {
        if (!anime?.nextAiringEpisode) return;

        const updateCountdown = () => {
            const remaining =
                anime.nextAiringEpisode!.airingAt -
                Math.floor(Date.now() / 1000);

            setTimeLeft(Math.max(remaining, 0));
        };

        updateCountdown();

        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [anime]);

    const startWatching = () => {
        if (!anime) return;

        router.push(
            `/anime/${anime.id}/watch?episode=${selectedEpisode}&type=sub&provider=${encodeURIComponent(
                selectedProvider
            )}`
        );
    };

    if (loading) {
        return (
            <>
                {!showProviderModal && <AnimeNavbar />}

                <main className="anime-detail-page">
                    <div className="anime-detail-loading">
                        Loading anime...
                    </div>
                </main>
            </>
        );
    }

    if (error || !anime) {
        return (
            <>
                {!showProviderModal && <AnimeNavbar />}

                <main className="anime-detail-page">
                    <div className="anime-detail-error">
                        <h1>Anime not found</h1>

                        <Link href="/anime">
                            Back to Anime
                        </Link>
                    </div>
                </main>
            </>
        );
    }

    // Related-anime UI shared by the Overview layout and the "More Like
    // This" tab, so both render exactly the same markup.
    const recommendationsList = (
        <div className="anime-recommendation-list">
            {anime.recommendations.slice(0, 3).map((item) => (
                <Link
                    key={item.id}
                    href={`/anime/${item.id}`}
                    className="anime-recommendation"
                >
                    <img src={item.poster} alt={item.title} />

                    <div className="anime-recommendation-info">
                        <strong>{item.title}</strong>
                    </div>

                    {item.type && <span>{item.type}</span>}
                </Link>
            ))}
        </div>
    );

    const relatedMediaSection = anime.relatedMedia.length > 0 && (
        <div className="anime-detail-related-media">
            <div className="anime-detail-section-heading">
                <span>RELATIONS</span>
                <h3>Related Media</h3>
            </div>

            <div className="anime-related-media-grid">
                {anime.relatedMedia.slice(0, 6).map((item) => (
                    <Link
                        key={`${item.id}-${item.relationType}`}
                        href={`/anime/${item.id}`}
                        className="anime-related-media-card"
                    >
                        <img src={item.poster} alt={item.title} />

                        <div className="anime-related-media-info">
                            <span className="anime-related-media-relation">
                                {formatRelationType(item.relationType)}
                            </span>

                            <strong>{item.title}</strong>

                            <div className="anime-related-media-meta">
                                <span>{item.type}</span>

                                {item.episodes && (
                                    <span>EP {item.episodes}</span>
                                )}

                                {item.duration && (
                                    <span>{item.duration}</span>
                                )}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );

    return (
        <>
            {!showProviderModal && <AnimeNavbar />}

            <main className="anime-detail-page">
                {/* HERO */}
                <section
                    className="anime-detail-hero"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                to right,
                                rgba(0,0,0,0.95) 0%,
                                rgba(0,0,0,0.75) 45%,
                                rgba(0,0,0,0.25) 100%
                            ),
                            linear-gradient(
                                to top,
                                #000 0%,
                                transparent 60%
                            ),
                            url("${anime.banner || anime.poster}")
                        `,
                    }}
                >
                    <div className="anime-detail-container">
                        <div className="anime-detail-hero-inner">

                            {/* LEFT CONTENT */}
                            <div className="anime-detail-hero-content">

                                <div className="anime-detail-meta">
                                    {anime.year && (
                                        <span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="12"
                                                height="12"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M8 2v4" />
                                                <path d="M16 2v4" />
                                                <rect
                                                    width="18"
                                                    height="18"
                                                    x="3"
                                                    y="4"
                                                    rx="2"
                                                />
                                                <path d="M3 10h18" />
                                            </svg>

                                            {anime.year}
                                        </span>
                                    )}

                                    <span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <rect
                                                width="20"
                                                height="15"
                                                x="2"
                                                y="7"
                                                rx="2"
                                            />
                                            <polyline points="17 2 12 7 7 2" />
                                        </svg>

                                        {anime.type}
                                    </span>
                                </div>

                                <h1>{anime.title}</h1>

                                {anime.nativeTitle && (
                                    <p className="anime-detail-native-title">
                                        {anime.nativeTitle}
                                    </p>
                                )}

                                <div className="anime-detail-genres">
                                    {anime.genres.map((genre) => (
                                        <Link
                                            key={genre}
                                            href={`/genre/${encodeURIComponent(
                                                genre
                                            )}`}
                                        >
                                            {genre}
                                        </Link>
                                    ))}
                                </div>

                                <div className="anime-detail-actions">
                                    <button
                                        type="button"
                                        className="anime-detail-watch"
                                        onClick={() => {
                                            setSelectedEpisode(continueEpisode ?? 1);
                                            setShowProviderModal(true);
                                        }}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <polygon points="6 3 20 12 6 21 6 3" />
                                        </svg>

                                        {continueEpisode
                                            ? `Continue Episode ${continueEpisode}`
                                            : "Watch Now"}
                                    </button>

                                    <button
                                        type="button"
                                        className={`anime-detail-secondary${
                                            saved ? " is-active" : ""
                                        }`}
                                        aria-pressed={saved}
                                        onClick={toggleSaved}
                                        disabled={savedLoading || savedPending}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill={saved ? "currentColor" : "none"}
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                        </svg>

                                        {savedPending
                                            ? "Saving…"
                                            : savedLoading
                                              ? "Loading…"
                                              : saved
                                                ? "Unsave"
                                                : "Save"}
                                    </button>

                                    <button
                                        type="button"
                                        className="anime-detail-secondary"
                                        aria-label={
                                            favorite
                                                ? "Remove from favorites"
                                                : "Add to favorites"
                                        }
                                        aria-pressed={favorite}
                                        onClick={toggleFavorite}
                                        disabled={
                                            favoriteLoading || favoritePending
                                        }
                                    >
                                        <Heart
                                            size={16}
                                            fill={
                                                favorite
                                                    ? "#ff4d67"
                                                    : "none"
                                            }
                                            color={
                                                favorite
                                                    ? "#ff4d67"
                                                    : "currentColor"
                                            }
                                            aria-hidden="true"
                                        />
                                        Favorite
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT POSTER */}
                            <div className="anime-detail-poster">
                                <img
                                    src={anime.poster}
                                    alt={anime.title}
                                />

                                <div className="anime-detail-poster-overlay">
                                    <div>
                                        <p>Seasons</p>
                                        <strong>
                                            {anime.type?.toUpperCase() ===
                                            "MOVIE"
                                                ? "—"
                                                : totalSeasons ?? "—"}
                                        </strong>
                                    </div>

                                    <div>
                                        <p>Episodes</p>
                                        <strong>
                                            {anime.type?.toUpperCase() ===
                                            "MOVIE"
                                                ? "—"
                                                : anime.episodes ?? "Unknown"}
                                        </strong>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* DETAILS */}
                <div className="anime-detail-page-container">
                    <section className="anime-detail-section">

                        <div className="anime-detail-heading-row">
                            <h2>Details</h2>

                            <button
                                type="button"
                                className="anime-detail-share-btn"
                                aria-label="Share"
                                onClick={shareAnime}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="18" cy="5" r="3" />
                                    <circle cx="6" cy="12" r="3" />
                                    <circle cx="18" cy="19" r="3" />
                                    <line
                                        x1="8.59"
                                        x2="15.42"
                                        y1="13.51"
                                        y2="17.49"
                                    />
                                    <line
                                        x1="15.41"
                                        x2="8.59"
                                        y1="6.51"
                                        y2="10.49"
                                    />
                                </svg>
                            </button>
                        </div>

                        <p className="anime-detail-subtitle">
                            Explore more about {anime.title}
                        </p>

                        <div className="anime-detail-tabs">
                            <button
                                className={
                                    activeTab === "overview"
                                        ? "active"
                                        : ""
                                }
                                onClick={() => setActiveTab("overview")}
                            >
                                Overview
                            </button>

                            <button
                                className={
                                    activeTab === "episodes"
                                        ? "active"
                                        : ""
                                }
                                onClick={() => setActiveTab("episodes")}
                            >
                                Episodes
                            </button>

                            <button
                                className={
                                    activeTab === "more" ? "active" : ""
                                }
                                onClick={() => setActiveTab("more")}
                            >
                                More Like This
                            </button>
                        </div>

                        {activeTab === "episodes" && (
                            <div className="mt-6 pb-28">
                                {detailEpisodes.length === 0 ? (
                                    <p className="py-12 text-center font-mono text-[13px] text-white/40">
                                        No episodes available yet.
                                    </p>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {visibleEpisodes.map((episode) => {
                                                const heading = episode.title
                                                    ? `Episode ${episode.number} - ${episode.title}`
                                                    : `Episode ${episode.number}`;

                                                return (
                                                    <button
                                                        key={episode.number}
                                                        type="button"
                                                        title={heading}
                                                        className="latest-episode-card w-full cursor-pointer appearance-none p-0 text-left"
                                                        onClick={() => {
                                                            setSelectedEpisode(
                                                                episode.number
                                                            );
                                                            setShowProviderModal(
                                                                true
                                                            );
                                                        }}
                                                    >
                                                        {episode.thumbnail && (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                className="latest-episode-card-bg"
                                                                src={
                                                                    episode.thumbnail
                                                                }
                                                                alt=""
                                                                loading="lazy"
                                                                draggable={false}
                                                            />
                                                        )}

                                                        <div className="latest-episode-card-shade" />

                                                        <div className="latest-episode-card-body">
                                                            <p className="latest-episode-card-title">
                                                                <span>
                                                                    {heading}
                                                                </span>
                                                                <ChevronRight
                                                                    size={14}
                                                                    aria-hidden="true"
                                                                />
                                                            </p>

                                                            <p className="latest-episode-card-sub">
                                                                Episode{" "}
                                                                {episode.number}
                                                                <span> · </span>
                                                                English Sub
                                                            </p>

                                                            {episode.title && (
                                                                <p className="latest-episode-card-native">
                                                                    {episode.title}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="latest-episode-card-pills">
                                                            <span className="latest-episode-pill">
                                                                {PROVIDERS.length}{" "}
                                                                {PROVIDERS.length === 1
                                                                    ? "Provider"
                                                                    : "Providers"}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {(canLoadMoreEpisodes ||
                                            canShowLessEpisodes) && (
                                            <div className="mt-4 flex justify-center gap-3">
                                                {canLoadMoreEpisodes && (
                                                    <button
                                                        type="button"
                                                        className="latest-episodes-toggle"
                                                        onClick={() =>
                                                            setVisibleEpisodeCount(
                                                                (current) =>
                                                                    Math.min(
                                                                        current +
                                                                            EPISODE_PAGE_SIZE,
                                                                        episodeTotal
                                                                    )
                                                            )
                                                        }
                                                    >
                                                        <ChevronDown
                                                            size={13}
                                                            aria-hidden="true"
                                                        />
                                                        LOAD MORE
                                                    </button>
                                                )}

                                                {canShowLessEpisodes && (
                                                    <button
                                                        type="button"
                                                        className="latest-episodes-toggle"
                                                        onClick={() =>
                                                            setVisibleEpisodeCount(
                                                                (current) =>
                                                                    Math.max(
                                                                        current -
                                                                            EPISODE_PAGE_SIZE,
                                                                        EPISODE_PAGE_SIZE
                                                                    )
                                                            )
                                                        }
                                                    >
                                                        <ChevronUp
                                                            size={13}
                                                            aria-hidden="true"
                                                        />
                                                        SHOW LESS
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === "more" && (
                            <div className="anime-detail-body mt-6 pb-28">
                                {anime.recommendations.length > 0 ||
                                relatedMediaSection ? (
                                    <>
                                        {anime.recommendations.length > 0 && (
                                            <div className="anime-detail-recommendations">
                                                <h3>More Like This</h3>
                                                {recommendationsList}
                                            </div>
                                        )}

                                        {relatedMediaSection}
                                    </>
                                ) : (
                                    <p className="py-12 text-center font-mono text-[13px] text-white/40">
                                        Nothing related to show yet.
                                    </p>
                                )}
                            </div>
                        )}

                        {activeTab === "overview" && (
                            <>
                        <div className="anime-detail-body">
                            <div className="anime-detail-genre-pills">
                                {anime.genres.map((genre) => (
                                    <Link
                                        key={genre}
                                        href={`/genre/${encodeURIComponent(
                                            genre
                                        )}`}
                                    >
                                        {genre}
                                    </Link>
                                ))}
                            </div>

                            <div className="anime-detail-columns">
                                <div className="anime-detail-main">
                                    <div className="anime-detail-synopsis-header">
                                        <h3>Synopsis</h3>
                                    </div>

                                    <p
                                        dangerouslySetInnerHTML={{
                                            __html: anime.description,
                                        }}
                                    />
                                </div>

                                <div className="anime-detail-recommendations">
                                    <h3>More Like This</h3>

                                    {recommendationsList}
                                </div>
                            </div>
                        </div>

                        {relatedMediaSection}

                        <div className="anime-detail-stats-section">
                            <div className="anime-detail-stats">

                                <div>
                                    <span>Format</span>
                                    <strong>{anime.type}</strong>
                                </div>

                                <div>
                                    <span>Episodes</span>
                                    <strong>
                                        {anime.type?.toUpperCase() ===
                                        "MOVIE"
                                            ? "—"
                                            : anime.episodes ??
                                              "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Seasons</span>
                                    <strong>
                                        {anime.type?.toUpperCase() ===
                                        "MOVIE"
                                            ? "—"
                                            : totalSeasons ??
                                              "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Duration</span>
                                    <strong>
                                        {anime.duration
                                            ? `${anime.duration} min`
                                            : "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Score</span>
                                    <strong>
                                        {formatScore(anime.score) ??
                                            "N/A"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Status</span>
                                    <strong>
                                        {anime.status || "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Studio</span>
                                    <strong>
                                        {anime.studios.length
                                            ? anime.studios.join(", ")
                                            : "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Season</span>
                                    <strong>
                                        {anime.season &&
                                            anime.seasonYear
                                            ? `${anime.season} ${anime.seasonYear}`
                                            : "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Popularity</span>
                                    <strong>
                                        {anime.popularity
                                            ? anime.popularity.toLocaleString()
                                            : "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>MAL ID</span>
                                    <strong>
                                        {anime.idMal ?? "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Aired</span>
                                    <strong>
                                        {anime.startDate?.year
                                            ? `${anime.startDate.year}-${String(
                                                anime.startDate.month ?? 1
                                            ).padStart(
                                                2,
                                                "0"
                                            )}-${String(
                                                anime.startDate.day ?? 1
                                            ).padStart(
                                                2,
                                                "0"
                                            )}${anime.endDate?.year
                                                ? ` → ${anime.endDate.year}-${String(
                                                    anime.endDate
                                                        .month ?? 1
                                                ).padStart(
                                                    2,
                                                    "0"
                                                )}-${String(
                                                    anime.endDate
                                                        .day ?? 1
                                                ).padStart(
                                                    2,
                                                    "0"
                                                )}`
                                                : " → Present"
                                            }`
                                            : "Unknown"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Next Episode</span>

                                    {anime.nextAiringEpisode ? (
                                        <>
                                            <strong>
                                                Episode{" "}
                                                {
                                                    anime
                                                        .nextAiringEpisode
                                                        .episode
                                                }
                                            </strong>

                                            <small>
                                                {timeLeft !== null
                                                    ? formatTimeLeft(
                                                        timeLeft
                                                    )
                                                    : "Calculating..."}
                                            </small>
                                        </>
                                    ) : (
                                        <strong>N/A</strong>
                                    )}
                                </div>

                            </div>
                        </div>
                            </>
                        )}

                    </section>
                </div>
            </main>

            {toast && (
                <div className="anime-detail-toast" role="status">
                    {toast}
                </div>
            )}

            {/* PROVIDER MODAL */}
            <ProviderModal
                open={showProviderModal}
                selectedProvider={selectedProvider}
                onSelect={setSelectedProvider}
                onClose={() => setShowProviderModal(false)}
                onStart={startWatching}
            />
        </>
    );
}
