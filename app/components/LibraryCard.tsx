"use client";

import { Heart } from "lucide-react";

import { LIBRARY_STATUSES, type LibraryStatus } from "../lib/saved";
import { STATUS_LABELS, type LibraryEntry } from "../lib/library";
import AnimeCard from "./AnimeCard";

type LibraryCardProps = {
    entry: LibraryEntry;
    pending: boolean;
    onStatusChange: (entry: LibraryEntry, status: LibraryStatus) => void;
};

/**
 * A Library grid item: the shared <AnimeCard> poster plus the Library-only
 * overlays — a favourite marker, a watch-progress bar and the shelf selector.
 * The selector stops click propagation so changing status never opens the card.
 */
export default function LibraryCard({
    entry,
    pending,
    onStatusChange,
}: LibraryCardProps) {
    return (
        <div className="library-card">
            <AnimeCard
                id={entry.animeId}
                title={entry.title}
                image={entry.poster}
            />

            {entry.isFavorite && (
                <span className="library-card-fav" title="In your Favorites">
                    <Heart size={13} fill="currentColor" aria-hidden="true" />
                </span>
            )}

            {entry.progressPercent !== null && (
                <span
                    className="library-card-progress"
                    aria-hidden="true"
                    title={
                        entry.episode
                            ? `Episode ${entry.episode} · ${entry.progressPercent}%`
                            : `${entry.progressPercent}%`
                    }
                >
                    <span style={{ width: `${entry.progressPercent}%` }} />
                </span>
            )}

            <div className="library-card-status">
                <select
                    aria-label={`Shelf for ${entry.title}`}
                    value={entry.status}
                    disabled={pending}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                        onStatusChange(entry, event.target.value as LibraryStatus)
                    }
                >
                    {LIBRARY_STATUSES.map((status) => (
                        <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
