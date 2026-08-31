/**
 * Unified Library model.
 *
 * The Library page is one view over the three existing per-user collections —
 * `saved`, `favorites`, `watch-progress` — with no new storage. This module is
 * pure (no Firebase): the page fetches each collection once and merges them
 * here, then filters client-side.
 *
 * Shelf resolution for a title:
 *   1. explicit `saved.status`               (user picked it on a Library card)
 *   2. else "watching" if it has watch progress
 *   3. else "plan"
 */

import type { FavoriteAnimeItem } from "./favorites";
import type { LibraryStatus, SavedAnimeItem } from "./saved";
import type { WatchProgressItem } from "./watchProgress";

export type LibraryFilter = "all" | LibraryStatus;

export const LIBRARY_TABS: { key: LibraryFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "watching", label: "Watching" },
    { key: "plan", label: "Plan" },
    { key: "on_hold", label: "On Hold" },
    { key: "completed", label: "Completed" },
    { key: "dropped", label: "Dropped" },
];

export const STATUS_LABELS: Record<LibraryStatus, string> = {
    watching: "Watching",
    plan: "Plan",
    on_hold: "On Hold",
    completed: "Completed",
    dropped: "Dropped",
};

export function isLibraryFilter(value: string | null): value is LibraryFilter {
    return (
        value === "all" ||
        value === "watching" ||
        value === "plan" ||
        value === "on_hold" ||
        value === "completed" ||
        value === "dropped"
    );
}

export interface LibraryEntry {
    animeId: string;
    title: string;
    poster: string;
    status: LibraryStatus;
    /** True when the user has an explicit `saved.status` for this title. */
    statusPinned: boolean;
    isFavorite: boolean;
    /** Latest episode reached, from watch progress. */
    episode: number | null;
    /** 0–100, from watch progress; null when unknown. */
    progressPercent: number | null;
    /** Best available epoch-ms for "recently updated" sort. */
    updatedAt: number | null;
}

function percentOf(item: WatchProgressItem): number | null {
    if (
        item.currentTime === null ||
        item.duration === null ||
        item.duration <= 0
    ) {
        return null;
    }
    return Math.min(
        100,
        Math.max(0, Math.round((item.currentTime / item.duration) * 100))
    );
}

/**
 * Merge the three collections into one de-duplicated list, newest activity
 * first. `saved` is the identity spine; favorites / watch-progress fold in and
 * can introduce titles of their own.
 */
export function buildLibrary(
    saved: SavedAnimeItem[],
    favorites: FavoriteAnimeItem[],
    watchProgress: WatchProgressItem[]
): LibraryEntry[] {
    const byId = new Map<string, LibraryEntry>();

    const ensure = (
        animeId: string,
        title: string,
        poster: string
    ): LibraryEntry => {
        const current = byId.get(animeId);
        if (current) {
            if (!current.title || current.title === "Untitled") current.title = title;
            if (!current.poster) current.poster = poster;
            return current;
        }
        const created: LibraryEntry = {
            animeId,
            title: title || "Untitled",
            poster: poster || "",
            status: "plan",
            statusPinned: false,
            isFavorite: false,
            episode: null,
            progressPercent: null,
            updatedAt: null,
        };
        byId.set(animeId, created);
        return created;
    };

    const bump = (entry: LibraryEntry, at: number | null) => {
        if (at !== null && (entry.updatedAt === null || at > entry.updatedAt)) {
            entry.updatedAt = at;
        }
    };

    for (const item of saved) {
        const entry = ensure(item.animeId, item.title, item.poster);
        if (item.status) {
            entry.status = item.status;
            entry.statusPinned = true;
        }
        bump(entry, item.savedAt);
    }

    for (const item of watchProgress) {
        const entry = ensure(item.animeId, item.title, item.poster);
        entry.episode = item.episode;
        entry.progressPercent = percentOf(item);
        if (!entry.statusPinned) entry.status = "watching";
        bump(entry, item.updatedAt);
    }

    for (const item of favorites) {
        const entry = ensure(item.animeId, item.title, item.poster);
        entry.isFavorite = true;
        bump(entry, item.favoritedAt);
    }

    return [...byId.values()].sort(
        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    );
}

export function countByFilter(
    entries: LibraryEntry[]
): Record<LibraryFilter, number> {
    const counts: Record<LibraryFilter, number> = {
        all: entries.length,
        watching: 0,
        plan: 0,
        on_hold: 0,
        completed: 0,
        dropped: 0,
    };
    for (const entry of entries) counts[entry.status] += 1;
    return counts;
}

export function filterLibrary(
    entries: LibraryEntry[],
    filter: LibraryFilter
): LibraryEntry[] {
    return filter === "all"
        ? entries
        : entries.filter((entry) => entry.status === filter);
}
