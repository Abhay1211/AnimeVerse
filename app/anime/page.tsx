"use client";

import { useEffect, useState } from "react";

import AnimeHero from "../components/AnimeHero";
import AnimeCategories from "../components/AnimeCategories";
import AnimeRow from "../components/AnimeRow";
import TopTen from "../components/TopTen";
import type { Anime } from "../data/anime";

export default function AnimePage() {
    const [topAiring, setTopAiring] = useState<Anime[]>([]);
    const [mostPopular, setMostPopular] = useState<Anime[]>([]);
    const [mostFavorite, setMostFavorite] = useState<Anime[]>([]);
    const [recentlyAdded, setRecentlyAdded] = useState<Anime[]>([]);
    const [topUpcoming, setTopUpcoming] = useState<Anime[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAnime = async () => {
            try {
                const response = await fetch("/api/anime/home");

                if (!response.ok) {
                    throw new Error("Failed to fetch homepage anime");
                }

                const data: {
                    topAiring: Anime[];
                    mostPopular: Anime[];
                    mostFavorite: Anime[];
                    recentlyAdded: Anime[];
                    topUpcoming: Anime[];
                } = await response.json();

                setTopAiring(data.topAiring);
                setMostPopular(data.mostPopular);
                setMostFavorite(data.mostFavorite);
                setRecentlyAdded(data.recentlyAdded);
                setTopUpcoming(data.topUpcoming);
            } catch (error) {
                console.error("Failed to load anime:", error);
            } finally {
                setLoading(false);
            }
        };

        loadAnime();
    }, []);

    return (
        <main className="anime-page">

            <AnimeHero anime={topAiring.slice(0, 5)} />

            <AnimeCategories />

            <div className="anime-catalog">
                {loading ? (
                    <p>Loading anime...</p>
                ) : (
                    <>
                        <AnimeRow
                            title="TOP AIRING"
                            label="///"
                            anime={topAiring}
                        />

                        <AnimeRow
                            title="MOST POPULAR"
                            label="///"
                            anime={mostPopular}
                        />

                        <AnimeRow
                            title="MOST FAVORITE"
                            label="///"
                            anime={mostFavorite}
                        />

                        <AnimeRow
                            title="RECENTLY ADDED"
                            label="///"
                            anime={recentlyAdded}
                        />

                        <AnimeRow
                            title="TOP UPCOMING"
                            label="///"
                            anime={topUpcoming}
                        />
                    </>
                )}
            </div>

            {/* Top 10 intentionally stays at the bottom */}
            <TopTen
                day={topAiring}
                week={mostPopular}
                month={mostFavorite}
            />
        </main>
    );
}