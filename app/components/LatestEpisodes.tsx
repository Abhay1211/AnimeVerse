"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";

import AnimeCard from "./AnimeCard";
import LatestEpisodeCard from "./LatestEpisodeCard";
import type { LatestEpisode } from "./useHomeAnime";

type LatestEpisodesProps = {
    episodes: LatestEpisode[];
    /**
     * "episode" (default) → wide <LatestEpisodeCard> tiles (home page).
     * "poster"            → reuse the poster <AnimeCard>, matching the other
     *                        /browse rows (Top Airing, etc.).
     */
    cardStyle?: "episode" | "poster";
    /**
     * When false the "VIEW MORE" control is hidden and the section stays a
     * plain horizontal carousel (used on /browse).
     */
    expandable?: boolean;
};

/**
 * "/// LATEST EPISODES" section.
 *
 *   collapsed -> horizontal carousel with circular left/right nav flanking it
 *   expanded  -> the same cards in a multi-row grid, in normal document flow
 *                (so the rest of the page moves down)  [only when expandable]
 */
export default function LatestEpisodes({
    episodes,
    cardStyle = "episode",
    expandable = true,
}: LatestEpisodesProps) {
    const [expanded, setExpanded] = useState(false);
    const scrollerRef = useRef<HTMLDivElement>(null);

    if (episodes.length === 0) return null;

    const showExpanded = expandable && expanded;

    const scroll = (direction: "left" | "right") => {
        scrollerRef.current?.scrollBy({
            left: direction === "left" ? -400 : 400,
            behavior: "smooth",
        });
    };

    const renderCard = (episode: LatestEpisode) => {
        const key = `${episode.id}-${episode.latestEpisode}`;

        if (cardStyle === "poster") {
            return (
                <AnimeCard
                    key={key}
                    id={episode.id}
                    title={episode.title}
                    nativeTitle={episode.nativeTitle}
                    image={episode.poster}
                    score={episode.score ?? undefined}
                    episodes={episode.episodes ?? undefined}
                    format={episode.type}
                />
            );
        }

        return <LatestEpisodeCard key={key} episode={episode} />;
    };

    return (
        <section className="catalog-row latest-episodes">
            <div className="row-heading">
                <h2 className="row-title">
                    <span>///</span>
                    LATEST EPISODES
                </h2>
            </div>

            {showExpanded ? (
                <>
                    <div
                        className={`latest-episodes-grid ${
                            cardStyle === "poster"
                                ? "is-poster"
                                : ""
                        }`}
                    >
                        {episodes.map(renderCard)}
                    </div>

                    <div className="latest-episodes-more">
                        <button
                            type="button"
                            className="latest-episodes-toggle"
                            onClick={() => setExpanded(false)}
                        >
                            <ChevronUp size={13} aria-hidden="true" />
                            CLOSE
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="row-rail">
                        <button
                            type="button"
                            className="row-nav row-nav-left"
                            onClick={() => scroll("left")}
                            aria-label="Scroll left"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div
                            className="row-scroller latest-episodes-scroller"
                            ref={scrollerRef}
                        >
                            {episodes.map(renderCard)}
                        </div>

                        <button
                            type="button"
                            className="row-nav row-nav-right"
                            onClick={() => scroll("right")}
                            aria-label="Scroll right"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {expandable && (
                        <div className="latest-episodes-more">
                            <button
                                type="button"
                                className="latest-episodes-toggle"
                                onClick={() => setExpanded(true)}
                            >
                                <ChevronDown
                                    size={13}
                                    aria-hidden="true"
                                />
                                VIEW MORE
                                <span className="latest-episodes-count">
                                    ({episodes.length})
                                </span>
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
