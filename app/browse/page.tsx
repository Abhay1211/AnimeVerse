"use client";

import AnimeNavbar from "../components/AnimeNavbar";
import AnimeRow from "../components/AnimeRow";
import LatestEpisodes from "../components/LatestEpisodes";
import { useHomeAnime } from "../components/useHomeAnime";

/**
 * /browse — the main anime discovery page.
 *
 * Every section is driven by the single `GET /api/anime/home` payload (shared
 * with /anime via useHomeAnime), rendered with the existing <AnimeRow> /
 * <AnimeCard> and the <LatestEpisodes> section.
 */
export default function BrowsePage() {
    const {
        latestEpisodes,
        topAiring,
        mostPopular,
        latestCompleted,
        recentlyAdded,
        topUpcoming,
        loading,
    } = useHomeAnime();

    return (
        <>
            <AnimeNavbar />

            <main className="browse-page">
                <header className="browse-page-header">
                    <h1>Browse Anime</h1>
                </header>

                {loading ? (
                    <p className="browse-page-loading">
                        Loading anime...
                    </p>
                ) : (
                    <div className="browse-page-sections">
                        <LatestEpisodes
                            episodes={latestEpisodes}
                            cardStyle="poster"
                            expandable={false}
                        />

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
                            title="LATEST COMPLETED"
                            label="///"
                            anime={latestCompleted}
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
                    </div>
                )}
            </main>
        </>
    );
}
