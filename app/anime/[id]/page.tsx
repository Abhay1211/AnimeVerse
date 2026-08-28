"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AnimeNavbar from "../../components/AnimeNavbar";
import ProviderModal from "../../components/ProviderModal";

import {
    buildWatchStructure,
    formatScore,
    type Anime,
} from "../../data/anime";

/** Toggle an anime id inside a localStorage-backed list. Returns the new "on" state. */
function toggleStoredId(key: string, id: string): boolean {
    try {
        const current: string[] = JSON.parse(
            window.localStorage.getItem(key) || "[]"
        );
        const has = current.includes(id);
        const next = has
            ? current.filter((item) => item !== id)
            : [...current, id];

        window.localStorage.setItem(key, JSON.stringify(next));
        return !has;
    } catch {
        return false;
    }
}

function readStoredId(key: string, id: string): boolean {
    try {
        const current: string[] = JSON.parse(
            window.localStorage.getItem(key) || "[]"
        );
        return current.includes(id);
    } catch {
        return false;
    }
}

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

    const [favorite, setFavorite] = useState(false);
    const [planned, setPlanned] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

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

    // Restore favourite / plan-to-watch state from localStorage for this anime.
    useEffect(() => {
        if (!id) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFavorite(readStoredId("animeverse:favorites", id));
        setPlanned(readStoredId("animeverse:plan-to-watch", id));
    }, [id]);

    const toggleFavorite = () => {
        const on = toggleStoredId("animeverse:favorites", id);
        setFavorite(on);
        showToast(
            on ? "Added to favorites" : "Removed from favorites"
        );
    };

    const togglePlanned = () => {
        const on = toggleStoredId(
            "animeverse:plan-to-watch",
            id
        );
        setPlanned(on);
        showToast(
            on ? "Added to Plan to Watch" : "Removed from Plan to Watch"
        );
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

    useEffect(() => {
        if (!anime?.nextAiringEpisode) {
            setTimeLeft(null);
            return;
        }

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
            `/anime/${anime.id}/watch?episode=1&type=sub&provider=${encodeURIComponent(
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
                                        onClick={() =>
                                            setShowProviderModal(true)
                                        }
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

                                        Watch Now
                                    </button>

                                    <button
                                        type="button"
                                        className={`anime-detail-secondary${
                                            planned ? " is-active" : ""
                                        }`}
                                        aria-pressed={planned}
                                        onClick={togglePlanned}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill={planned ? "currentColor" : "none"}
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                        </svg>

                                        {planned
                                            ? "In Plan to Watch"
                                            : "Plan to Watch"}
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT POSTER */}
                            <div className="anime-detail-poster">
                                <button
                                    type="button"
                                    className={`anime-detail-favorite${
                                        favorite ? " is-active" : ""
                                    }`}
                                    aria-label={
                                        favorite
                                            ? "Remove from favorites"
                                            : "Add to favorites"
                                    }
                                    aria-pressed={favorite}
                                    onClick={toggleFavorite}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill={favorite ? "currentColor" : "none"}
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                                    </svg>
                                </button>

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

                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
                                    </svg>
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
                            <button className="active">
                                Overview
                            </button>

                            <button>
                                Episodes
                            </button>

                            <button>
                                More Like This
                            </button>
                        </div>

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

                                    <div className="anime-recommendation-list">
                                        {anime.recommendations
                                            .slice(0, 3)
                                            .map((item) => (
                                                <Link
                                                    key={item.id}
                                                    href={`/anime/${item.id}`}
                                                    className="anime-recommendation"
                                                >
                                                    <img
                                                        src={item.poster}
                                                        alt={item.title}
                                                    />

                                                    <div className="anime-recommendation-info">
                                                        <strong>
                                                            {item.title}
                                                        </strong>
                                                    </div>

                                                    {item.type && (
                                                        <span>
                                                            {item.type}
                                                        </span>
                                                    )}
                                                </Link>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {anime.relatedMedia.length > 0 && (
                            <div className="anime-detail-related-media">
                                <div className="anime-detail-section-heading">
                                    <span>RELATIONS</span>
                                    <h3>Related Media</h3>
                                </div>

                                <div className="anime-related-media-grid">
                                    {anime.relatedMedia
                                        .slice(0, 6)
                                        .map((item) => (
                                            <Link
                                                key={`${item.id}-${item.relationType}`}
                                                href={`/anime/${item.id}`}
                                                className="anime-related-media-card"
                                            >
                                                <img
                                                    src={item.poster}
                                                    alt={item.title}
                                                />

                                                <div className="anime-related-media-info">
                                                    <span className="anime-related-media-relation">
                                                        {formatRelationType(
                                                            item.relationType
                                                        )}
                                                    </span>

                                                    <strong>
                                                        {item.title}
                                                    </strong>

                                                    <div className="anime-related-media-meta">
                                                        <span>
                                                            {item.type}
                                                        </span>

                                                        {item.episodes && (
                                                            <span>
                                                                EP{" "}
                                                                {
                                                                    item.episodes
                                                                }
                                                            </span>
                                                        )}

                                                        {item.duration && (
                                                            <span>
                                                                {
                                                                    item.duration
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                </div>
                            </div>
                        )}

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