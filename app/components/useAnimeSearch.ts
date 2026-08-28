"use client";

import { useEffect, useState } from "react";
import type { Anime } from "../data/anime";

/**
 * Shared anime-search hook.
 *
 * Wraps the EXISTING `/api/anime/browse?search=` endpoint (also used by the
 * /genre pages) so the home-page search bar and the /search page don't each
 * reimplement fetching / debouncing / de-duping.
 */

type BrowseSearchResponse = {
    anime: Anime[];
    pagination?: { total?: number };
};

type SearchState = {
    results: Anime[];
    total: number;
    loading: boolean;
    error: boolean;
    /** The (trimmed, debounced) term the current results belong to. */
    term: string;
};

const EMPTY: SearchState = {
    results: [],
    total: 0,
    loading: false,
    error: false,
    term: "",
};

// In-flight request de-dupe, shared across every consumer of the hook.
const inFlight = new Map<string, Promise<BrowseSearchResponse>>();

type Options = {
    /** Debounce applied to `query` before it triggers a request. */
    debounceMs?: number;
    /** perPage forwarded to the browse API. */
    perPage?: number;
};

export function useAnimeSearch(
    query: string,
    { debounceMs = 350, perPage = 20 }: Options = {}
): SearchState {
    const trimmedQuery = query.trim();

    const [debouncedTerm, setDebouncedTerm] =
        useState(trimmedQuery);

    // When debouncing is off (submit-driven pages) the term is just the
    // current query — no state, no synchronous setState in an effect.
    const term =
        debounceMs <= 0 ? trimmedQuery : debouncedTerm;

    useEffect(() => {
        if (debounceMs <= 0) return;

        const id = window.setTimeout(
            () => setDebouncedTerm(trimmedQuery),
            debounceMs
        );

        return () => window.clearTimeout(id);
    }, [trimmedQuery, debounceMs]);

    const [state, setState] = useState<SearchState>(EMPTY);

    // React to `term` changes during render (avoids a synchronous
    // setState inside the fetch effect).
    const [trackedTerm, setTrackedTerm] = useState(term);

    if (term !== trackedTerm) {
        setTrackedTerm(term);

        setState(
            term
                ? (prev) => ({
                      ...prev,
                      loading: true,
                      error: false,
                  })
                : EMPTY
        );
    }

    useEffect(() => {
        if (!term) return;

        let cancelled = false;

        const url = `/api/anime/browse?search=${encodeURIComponent(
            term
        )}&perPage=${perPage}`;

        let request = inFlight.get(url);

        if (!request) {
            request = fetch(url).then(async (response) => {
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.error || "Search request failed"
                    );
                }

                return data as BrowseSearchResponse;
            });

            inFlight.set(url, request);

            void request.then(
                () => inFlight.delete(url),
                () => inFlight.delete(url)
            );
        }

        request
            .then((data) => {
                if (cancelled) return;

                setState({
                    results: data.anime ?? [],
                    total: data.pagination?.total ?? 0,
                    loading: false,
                    error: false,
                    term,
                });
            })
            .catch(() => {
                if (cancelled) return;

                setState({
                    results: [],
                    total: 0,
                    loading: false,
                    error: true,
                    term,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [term, perPage]);

    return state;
}
