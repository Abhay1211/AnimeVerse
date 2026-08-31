"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AnimeNavbar from "../components/AnimeNavbar";
import ConfirmModal from "../components/ConfirmModal";
import { useAuthUser } from "../lib/useAuthUser";
import {
    clearRecentlyViewed,
    fetchRecentlyViewed,
    type RecentlyViewedItem,
} from "../lib/recentlyViewed";
import { fetchWatchProgress } from "../lib/watchProgress";

type RecentCard = RecentlyViewedItem & { episode: number | null };

type FetchState = {
    status: "loading" | "ready" | "error";
    items: RecentCard[];
};

const AUTH_LINK_STYLE: React.CSSProperties = {
    color: "#fff",
    borderBottom: "1px solid rgba(255, 255, 255, 0.4)",
    paddingBottom: 2,
};

function formatDate(timestamp: number | null): string {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleDateString();
}

export default function RecentlyViewedPage() {
    const { user, loading: authLoading } = useAuthUser();

    const [fetchState, setFetchState] = useState<FetchState>({
        status: "loading",
        items: [],
    });
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (authLoading || !user) return;

        let cancelled = false;

        Promise.all([
            fetchRecentlyViewed(user.uid),
            fetchWatchProgress(user.uid),
        ])
            .then(([recent, progress]) => {
                if (cancelled) return;
                const episodeByAnime = new Map(
                    progress.map((entry) => [entry.animeId, entry.episode])
                );
                setFetchState({
                    status: "ready",
                    items: recent.map((item) => ({
                        ...item,
                        episode: episodeByAnime.get(item.animeId) ?? null,
                    })),
                });
            })
            .catch((error) => {
                if (cancelled) return;
                if (process.env.NODE_ENV !== "production") {
                    console.error("Failed to load recently viewed:", error);
                }
                setFetchState({ status: "error", items: [] });
            });

        return () => {
            cancelled = true;
        };
    }, [user, authLoading]);

    const clearAll = async () => {
        if (!user) return;
        try {
            await clearRecentlyViewed(user.uid);
        } catch (error) {
            // Keep the original Firebase error/code in the console (always, not
            // just in dev) so a future permissions/config failure is diagnosable,
            // then surface a friendly message on the modal.
            const code =
                typeof error === "object" && error !== null && "code" in error
                    ? (error as { code?: unknown }).code
                    : undefined;
            console.error(
                "Clear All (recently viewed) failed",
                code ? `(code: ${String(code)})` : "",
                error
            );
            throw new Error(
                "Could not clear your watch history. Please try again."
            );
        }
        setFetchState({ status: "ready", items: [] });
        setConfirmOpen(false);
    };

    const view = authLoading
        ? "loading"
        : !user
          ? "signed-out"
          : fetchState.status;

    const hasItems = useMemo(
        () => fetchState.status === "ready" && fetchState.items.length > 0,
        [fetchState]
    );

    return (
        <>
            <AnimeNavbar />

            <main className="recent-page">
                <header className="recent-header">
                    <div>
                        <h1>Recently Viewed</h1>
                        <p>Your watch history</p>
                    </div>
                    {hasItems && (
                        <button
                            type="button"
                            className="recent-clear"
                            onClick={() => setConfirmOpen(true)}
                        >
                            <Trash2 size={14} aria-hidden="true" />
                            Clear All
                        </button>
                    )}
                </header>

                {view === "loading" && (
                    <div className="anime-browse-loading">LOADING…</div>
                )}

                {view === "signed-out" && (
                    <div
                        className="anime-browse-empty"
                        style={{ flexDirection: "column", gap: 16, textAlign: "center" }}
                    >
                        <span>SIGN IN TO SEE YOUR WATCH HISTORY.</span>
                        <span style={{ display: "flex", gap: 20 }}>
                            <Link href="/auth" style={AUTH_LINK_STYLE}>
                                SIGN IN
                            </Link>
                            <Link href="/auth?mode=signup" style={AUTH_LINK_STYLE}>
                                CREATE ACCOUNT
                            </Link>
                        </span>
                    </div>
                )}

                {view === "error" && (
                    <div className="anime-browse-empty">
                        COULDN&apos;T LOAD YOUR WATCH HISTORY. PLEASE TRY AGAIN LATER.
                    </div>
                )}

                {view === "ready" && fetchState.items.length === 0 && (
                    <div className="anime-browse-empty">
                        NO WATCH HISTORY YET.
                    </div>
                )}

                {hasItems && (
                    <div className="recent-grid">
                        {fetchState.items.map((item) => (
                            <Link
                                key={item.animeId}
                                href={`/anime/${encodeURIComponent(item.animeId)}`}
                                className="recent-card"
                            >
                                <div className="recent-card-poster">
                                    {item.poster ? (
                                        <img
                                            src={item.poster}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    ) : (
                                        <div className="recent-card-poster-empty" />
                                    )}
                                    {item.episode !== null && (
                                        <span className="recent-card-badge">
                                            EP {item.episode}
                                        </span>
                                    )}
                                </div>
                                <strong>{item.title}</strong>
                                <time>{formatDate(item.watchedAt)}</time>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            <ConfirmModal
                open={confirmOpen}
                tone="danger"
                icon={Trash2}
                title="Clear watch history?"
                description="This will permanently remove your entire recently viewed history. This action cannot be undone."
                note="This action is permanent and cannot be reversed."
                confirmLabel="Clear History"
                busyLabel="Clearing…"
                onConfirm={clearAll}
                onClose={() => setConfirmOpen(false)}
            />
        </>
    );
}
