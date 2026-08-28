"use client";

import AnimeHero from "../components/AnimeHero";
import AnimeSearch from "../components/AnimeSearch";
import AnimeCategories from "../components/AnimeCategories";
import AnimeRow from "../components/AnimeRow";
import LatestEpisodes from "../components/LatestEpisodes";
import TopTen from "../components/TopTen";
import AnimeNavbar from "../components/AnimeNavbar";
import { useHomeAnime } from "../components/useHomeAnime";

export default function AnimePage() {
    const {
        heroAnime,
        latestEpisodes,
        topAiring,
        mostPopular,
        mostFavorite,
        recentlyAdded,
        topUpcoming,
        loading,
    } = useHomeAnime();

    return (
        <>
            <AnimeNavbar />

            <main className="anime-page">

            <AnimeHero
                anime={
                    heroAnime.length
                        ? heroAnime
                        : topAiring.slice(0, 15)
                }
            />

            <AnimeSearch />

            <AnimeCategories />

            <div className="anime-catalog">
                {loading ? (
                    <p>Loading anime...</p>
                ) : (
                    <>
                        <LatestEpisodes episodes={latestEpisodes} />

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
        </>
    );
}
