"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AnimeNavbar from "../../components/AnimeNavbar";

import type { Anime } from "../../data/anime";

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

type ProviderOption = {
    id: string;
    name: string;
    description: string;
    details: string;
    icon: string;
    recommended?: boolean;
};

const PROVIDERS: ProviderOption[] = [
    {
        id: "anikoto",
        name: "MegaPlay",
        description: "Fast and stable streaming",
        details: "MegaPlay · Primary · Sub/Dub",
        icon: "▣",
        recommended: true,
    },
    {
        id: "vidcloud",
        name: "CloudPlay",
        description: "Reliable cloud streaming",
        details: "VidCloud / Vidwish · Sub/Dub",
        icon: "ϟ",
    },
    {
        id: "kiwi",
        name: "KiwiStream",
        description: "Smooth alternative streaming",
        details: "Kiwi Stream · Sub/Dub",
        icon: "◎",
    },
    {
        id: "vidstream",
        name: "StreamX",
        description: "Classic high-availability source",
        details: "Vidstream variants · Sub/Dub",
        icon: "≋",
    },
    {
        id: "others",
        name: "Nexus",
        description: "Additional available sources",
        details: "Other providers · Sub/Dub",
        icon: "◇",
    },
];

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
        useState<string>("anikoto");

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

    useEffect(() => {
        if (!showProviderModal) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowProviderModal(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [showProviderModal]);

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
                                        <a
                                            key={genre}
                                            href={`/genre/${genre.toLowerCase()}`}
                                        >
                                            {genre}
                                        </a>
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
                                        className="anime-detail-secondary"
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
                                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                        </svg>

                                        Plan to Watch
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT POSTER */}
                            <div className="anime-detail-poster">
                                <button
                                    type="button"
                                    className="anime-detail-favorite"
                                    aria-label="Add to favorites"
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
                                        <strong>—</strong>
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
                                    <span key={genre}>{genre}</span>
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
                                        {anime.episodes ?? "Unknown"}
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
                                        {anime.score
                                            ? `${anime.score}%`
                                            : "N/A"}
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

            {/* PROVIDER MODAL */}
            {showProviderModal && (
                <div
                    className="
                        fixed inset-0 z-[100]
                        flex items-center justify-center
                        bg-black/75
                        px-3 py-4 sm:px-5
                        backdrop-blur-md
                    "
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setShowProviderModal(false);
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="provider-modal-title"
                        className="
                            relative
                            flex w-full max-w-[680px]
                            max-h-[calc(100dvh-32px)]
                            flex-col
                            overflow-hidden
                            rounded-2xl
                            border border-white/10
                            bg-[#111]
                            shadow-2xl
                        "
                    >
                        {/* HEADER */}
                        <div className="shrink-0 border-b border-white/10 px-5 py-4 sm:px-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <h2
                                        id="provider-modal-title"
                                        className="font-mono text-lg font-bold tracking-tight text-white sm:text-xl"
                                    >
                                        Choose Provider
                                    </h2>

                                    <p className="mt-1.5 text-[11px] leading-4 text-white/40 sm:text-xs">
                                        Select your preferred streaming
                                        provider before watching.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowProviderModal(false)
                                    }
                                    className="
                                        flex h-8 w-8 shrink-0
                                        items-center justify-center
                                        rounded-full
                                        text-white/40
                                        transition
                                        hover:bg-white/10
                                        hover:text-white
                                    "
                                    aria-label="Close provider selection"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* PROVIDERS */}
                        <div
                            className="
                                min-h-0
                                flex-1
                                space-y-2
                                overflow-y-auto
                                px-5 py-4
                                sm:px-6
                            "
                        >
                            {PROVIDERS.map((provider, index) => {
                                const isSelected =
                                    selectedProvider === provider.id;

                                return (
                                    <button
                                        key={provider.id}
                                        type="button"
                                        onClick={() =>
                                            setSelectedProvider(
                                                provider.id
                                            )
                                        }
                                        className={`
                                            group w-full
                                            rounded-xl
                                            border
                                            p-3
                                            text-left
                                            transition-all
                                            duration-200
                                            sm:p-3.5
                                            ${isSelected
                                                ? "border-white bg-white/[0.10]"
                                                : "border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.06]"
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4">

                                            {/* ICON */}
                                            <div
                                                className={`
                                                    flex h-10 w-10
                                                    shrink-0
                                                    items-center
                                                    justify-center
                                                    rounded-full
                                                    border
                                                    font-mono
                                                    text-base
                                                    transition
                                                    sm:h-11 sm:w-11
                                                    sm:text-lg
                                                    ${isSelected
                                                        ? "border-white/40 bg-white/10 text-white"
                                                        : "border-white/10 bg-white/[0.04] text-white/50"
                                                    }
                                                `}
                                            >
                                                {provider.icon}
                                            </div>

                                            {/* CONTENT */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3
                                                        className={`
                                                            truncate
                                                            font-mono
                                                            text-sm
                                                            font-bold
                                                            ${isSelected
                                                                ? "text-white"
                                                                : "text-white/90"
                                                            }
                                                        `}
                                                    >
                                                        {provider.name}
                                                    </h3>

                                                    {provider.recommended && (
                                                        <span
                                                            className="
                                                                hidden
                                                                shrink-0
                                                                rounded-md
                                                                bg-white
                                                                px-2
                                                                py-0.5
                                                                font-mono
                                                                text-[8px]
                                                                font-bold
                                                                uppercase
                                                                tracking-wider
                                                                text-black
                                                                sm:inline-flex
                                                            "
                                                        >
                                                            Recommended
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="mt-0.5 truncate text-[11px] text-white/55 sm:text-xs">
                                                    {provider.description}
                                                </p>

                                                <p className="mt-0.5 truncate font-mono text-[9px] text-white/30 sm:text-[10px]">
                                                    {provider.details}
                                                </p>
                                            </div>

                                            {/* RANK */}
                                            <div
                                                className={`
                                                    shrink-0
                                                    font-mono
                                                    text-[10px]
                                                    font-bold
                                                    sm:text-xs
                                                    ${isSelected
                                                        ? "text-white/70"
                                                        : "text-white/20"
                                                    }
                                                `}
                                            >
                                                {String(index + 1).padStart(
                                                    2,
                                                    "0"
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* START WATCHING */}
                        <div
                            className="
                                shrink-0
                                border-t border-white/10
                                px-5 py-4
                                sm:px-6
                            "
                        >
                            <button
                                type="button"
                                onClick={startWatching}
                                className="
                                    flex h-11 w-full
                                    items-center justify-center
                                    gap-3
                                    rounded-xl
                                    bg-white
                                    font-mono
                                    text-sm
                                    font-bold
                                    text-black
                                    transition
                                    hover:bg-white/90
                                    active:scale-[0.99]
                                "
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <polygon points="6 3 20 12 6 21 6 3" />
                                </svg>

                                Start Watching
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}