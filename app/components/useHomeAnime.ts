"use client";

import { useEffect, useState } from "react";
import type { Anime } from "../data/anime";

/**
 * Shared loader for `GET /api/anime/home`.
 *
 * Both /anime and /browse render sections off the same payload, so the fetch
 * (and its result) is memoised at module scope — navigating between the two
 * pages reuses the response instead of hitting the endpoint again.
 */

export type LatestEpisode = Anime & {
    latestEpisode: number;
    airingAt: number;
    episodeThumbnail: string;
    providerCount: number;
};

export type HomeAnimeData = {
    latestEpisodes: LatestEpisode[];
    topAiring: Anime[];
    mostPopular: Anime[];
    mostFavorite: Anime[];
    latestCompleted: Anime[];
    recentlyAdded: Anime[];
    topUpcoming: Anime[];
};

const EMPTY: HomeAnimeData = {
    latestEpisodes: [],
    topAiring: [],
    mostPopular: [],
    mostFavorite: [],
    latestCompleted: [],
    recentlyAdded: [],
    topUpcoming: [],
};

let cached: HomeAnimeData | null = null;
let inFlight: Promise<HomeAnimeData> | null = null;

function loadHomeAnime(): Promise<HomeAnimeData> {
    if (cached) return Promise.resolve(cached);

    if (!inFlight) {
        inFlight = fetch("/api/anime/home")
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        "Failed to fetch homepage anime"
                    );
                }

                const data = (await response.json()) as Partial<HomeAnimeData>;

                cached = { ...EMPTY, ...data };
                return cached;
            })
            .finally(() => {
                inFlight = null;
            });
    }

    return inFlight;
}

type HomeAnimeState = HomeAnimeData & {
    loading: boolean;
    error: boolean;
};

export function useHomeAnime(): HomeAnimeState {
    const [data, setData] = useState<HomeAnimeData>(
        cached ?? EMPTY
    );
    const [loading, setLoading] = useState(!cached);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (cached) {
            setData(cached);
            setLoading(false);
            return;
        }

        let active = true;

        loadHomeAnime()
            .then((result) => {
                if (!active) return;

                setData(result);
                setLoading(false);
            })
            .catch(() => {
                if (!active) return;

                setError(true);
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    return { ...data, loading, error };
}
