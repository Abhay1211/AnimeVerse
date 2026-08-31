"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import AnimeNavbar from "../components/AnimeNavbar";
import LibraryCard from "../components/LibraryCard";
import { fetchFavorites, type FavoriteAnimeItem } from "../lib/favorites";
import {
    buildLibrary,
    countByFilter,
    filterLibrary,
    isLibraryFilter,
    LIBRARY_TABS,
    STATUS_LABELS,
    type LibraryEntry,
    type LibraryFilter,
} from "../lib/library";
import {
    fetchSavedAnime,
    setLibraryStatus,
    type LibraryStatus,
    type SavedAnimeItem,
} from "../lib/saved";
import { useAuthUser } from "../lib/useAuthUser";
import {
    fetchWatchProgress,
    type WatchProgressItem,
} from "../lib/watchProgress";

type RawLibrary = {
    saved: SavedAnimeItem[];
    favorites: FavoriteAnimeItem[];
    watchProgress: WatchProgressItem[];
};

export default function LibraryView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuthUser();

    const paramFilter = searchParams.get("filter");
    const [filter, setFilter] = useState<LibraryFilter>(
        isLibraryFilter(paramFilter) ? paramFilter : "all"
    );

    const [raw, setRaw] = useState<RawLibrary | null>(null);
    const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
        "loading"
    );
    const [overrides, setOverrides] = useState<Record<string, LibraryStatus>>({});
    const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace("/auth");
            return;
        }

        let cancelled = false;
        Promise.all([
            fetchSavedAnime(user.uid),
            fetchFavorites(user.uid),
            fetchWatchProgress(user.uid),
        ])
            .then(([saved, favorites, watchProgress]) => {
                if (cancelled) return;
                setRaw({ saved, favorites, watchProgress });
                setLoadState("ready");
            })
            .catch((error) => {
                if (cancelled) return;
                if (process.env.NODE_ENV !== "production") {
                    console.error("Failed to load library:", error);
                }
                setLoadState("error");
            });

        return () => {
            cancelled = true;
        };
    }, [authLoading, router, user]);

    const entries = useMemo<LibraryEntry[]>(() => {
        if (!raw) return [];
        return buildLibrary(raw.saved, raw.favorites, raw.watchProgress).map(
            (entry) =>
                overrides[entry.animeId]
                    ? { ...entry, status: overrides[entry.animeId], statusPinned: true }
                    : entry
        );
    }, [raw, overrides]);

    const counts = useMemo(() => countByFilter(entries), [entries]);
    const visible = useMemo(
        () => filterLibrary(entries, filter),
        [entries, filter]
    );

    const selectTab = useCallback(
        (key: LibraryFilter) => {
            setFilter(key);
            router.replace(key === "all" ? "/library" : `/library?filter=${key}`, {
                scroll: false,
            });
        },
        [router]
    );

    const handleStatusChange = useCallback(
        async (entry: LibraryEntry, status: LibraryStatus) => {
            if (!user || status === entry.status) return;

            const previous = overrides[entry.animeId];
            setActionError(null);
            setOverrides((current) => ({ ...current, [entry.animeId]: status }));
            setPendingIds((current) => new Set(current).add(entry.animeId));

            try {
                await setLibraryStatus(
                    user.uid,
                    {
                        animeId: entry.animeId,
                        title: entry.title,
                        poster: entry.poster,
                    },
                    status
                );
            } catch (error) {
                if (process.env.NODE_ENV !== "production") {
                    console.error("Failed to set library status:", error);
                }
                setOverrides((current) => {
                    const next = { ...current };
                    if (previous) next[entry.animeId] = previous;
                    else delete next[entry.animeId];
                    return next;
                });
                setActionError("Couldn’t update that title. Please try again.");
            } finally {
                setPendingIds((current) => {
                    const next = new Set(current);
                    next.delete(entry.animeId);
                    return next;
                });
            }
        },
        [overrides, user]
    );

    const totalTitles = entries.length;
    const view = authLoading || !user ? "loading" : loadState;

    return (
        <>
            <AnimeNavbar />
            <main className="library-page">
                <header className="library-header">
                    <span className="library-header-icon" aria-hidden="true">
                        <Bookmark size={20} />
                    </span>
                    <div>
                        <h1>My List</h1>
                        <p>
                            {totalTitles} {totalTitles === 1 ? "title" : "titles"}
                            <span> · synced to your account</span>
                        </p>
                    </div>
                </header>

                <nav className="library-tabs" aria-label="Library shelves">
                    {LIBRARY_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`library-tab ${filter === tab.key ? "is-active" : ""}`}
                            aria-pressed={filter === tab.key}
                            onClick={() => selectTab(tab.key)}
                        >
                            {tab.label}
                            <span className="library-tab-count">{counts[tab.key]}</span>
                        </button>
                    ))}
                </nav>

                {actionError && (
                    <p className="library-action-error" role="alert">
                        {actionError}
                    </p>
                )}

                {view === "loading" && (
                    <div className="anime-browse-loading">LOADING…</div>
                )}

                {view === "error" && (
                    <div className="library-empty">
                        <p>Couldn’t load your list. Please try again later.</p>
                    </div>
                )}

                {view === "ready" && visible.length === 0 && (
                    <div className="library-empty">
                        {entries.length === 0 ? (
                            <>
                                <p>Your list is empty.</p>
                                <span>
                                    Open any anime and use <strong>Save</strong> or{" "}
                                    <strong>Favorite</strong> to add it here.
                                </span>
                                <Link href="/anime" className="library-empty-link">
                                    Browse anime →
                                </Link>
                            </>
                        ) : (
                            <>
                                <p>
                                    Nothing on your{" "}
                                    <strong>
                                        {filter === "all"
                                            ? "list"
                                            : STATUS_LABELS[filter]}
                                    </strong>{" "}
                                    shelf yet.
                                </p>
                                <button
                                    type="button"
                                    className="library-empty-link"
                                    onClick={() => selectTab("all")}
                                >
                                    View all titles →
                                </button>
                            </>
                        )}
                    </div>
                )}

                {view === "ready" && visible.length > 0 && (
                    <div className="anime-browse-grid library-grid">
                        {visible.map((entry) => (
                            <LibraryCard
                                key={entry.animeId}
                                entry={entry}
                                pending={pendingIds.has(entry.animeId)}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
