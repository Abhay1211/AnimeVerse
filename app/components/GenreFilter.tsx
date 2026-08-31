"use client";

import { ChevronDown, Search } from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

type GenreFilterProps = {
    /** Every selectable genre (canonical spelling). */
    allGenres: readonly string[];
    /** Currently committed genre selection. */
    selected: string[];
    /** Called with the new selection when the user presses Apply. */
    onApply: (genres: string[]) => void;
};

/**
 * Reference-style multi-select genre dropdown used on /genre/[genre].
 * Selection is staged locally and only committed via Apply, so the URL /
 * results are not touched until the user confirms.
 */
export default function GenreFilter({
    allGenres,
    selected,
    onApply,
}: GenreFilterProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [working, setWorking] = useState<string[]>(selected);

    const containerRef = useRef<HTMLDivElement>(null);

    // Keep the staged selection in sync with the committed one whenever the
    // parent commits a new selection (adjust-state-during-render — no effect).
    const selectedKey = selected.join("|");
    const [syncedKey, setSyncedKey] = useState(selectedKey);
    if (selectedKey !== syncedKey) {
        setSyncedKey(selectedKey);
        setWorking(selected);
    }

    // Close when clicking outside the dropdown.
    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(
                    event.target as Node
                )
            ) {
                setOpen(false);
            }
        };

        document.addEventListener(
            "mousedown",
            handlePointerDown
        );

        return () =>
            document.removeEventListener(
                "mousedown",
                handlePointerDown
            );
    }, [open]);

    const visibleGenres = useMemo(() => {
        const term = query.trim().toLowerCase();

        if (!term) return allGenres;

        return allGenres.filter((genre) =>
            genre.toLowerCase().includes(term)
        );
    }, [allGenres, query]);

    const toggleGenre = (genre: string) => {
        setWorking((current) =>
            current.includes(genre)
                ? current.filter((item) => item !== genre)
                : [...current, genre]
        );
    };

    return (
        <div className="genre-filter" ref={containerRef}>
            <button
                type="button"
                className="genre-filter-trigger"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
            >
                <span>Filter</span>
                <ChevronDown
                    size={14}
                    className={`genre-filter-chevron ${
                        open ? "is-open" : ""
                    }`}
                />
            </button>

            {open && (
                <div className="genre-filter-panel">
                    <div className="genre-filter-search">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={query}
                            onChange={(event) =>
                                setQuery(event.target.value)
                            }
                            autoFocus
                        />
                    </div>

                    <span className="genre-filter-count">
                        {working.length} selected
                    </span>

                    <div className="genre-filter-list">
                        {visibleGenres.map((genre) => (
                            <button
                                key={genre}
                                type="button"
                                className={`genre-filter-option ${
                                    working.includes(genre)
                                        ? "is-selected"
                                        : ""
                                }`}
                                onClick={() =>
                                    toggleGenre(genre)
                                }
                            >
                                {genre}
                            </button>
                        ))}

                        {visibleGenres.length === 0 && (
                            <span className="genre-filter-empty">
                                No genres
                            </span>
                        )}
                    </div>

                    <div className="genre-filter-actions">
                        <button
                            type="button"
                            className="genre-filter-apply"
                            onClick={() => {
                                onApply(working);
                                setOpen(false);
                            }}
                        >
                            Apply
                        </button>

                        <button
                            type="button"
                            className="genre-filter-clear"
                            onClick={() => setWorking([])}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
