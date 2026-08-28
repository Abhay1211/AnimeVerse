"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatScore } from "../data/anime";
import type { LatestEpisode } from "./useHomeAnime";

type LatestEpisodeCardProps = {
    episode: LatestEpisode;
};

/**
 * One "Latest Episodes" card — a landscape tile built from the same visual
 * language as the watch-page EpisodeRail rows (still background, episode
 * heading, sub-line, provider / score pills). Links to the anime, exactly
 * like <AnimeCard>.
 */
export default function LatestEpisodeCard({
    episode,
}: LatestEpisodeCardProps) {
    const heading = `Episode ${episode.latestEpisode} - ${episode.title}`;
    const rating = formatScore(episode.score);

    return (
        <Link
            href={`/anime/${episode.id}`}
            className="latest-episode-card"
            title={heading}
        >
            <span className="latest-episode-corner tl">x</span>
            <span className="latest-episode-corner tr">x</span>
            <span className="latest-episode-corner bl">x</span>
            <span className="latest-episode-corner br">x</span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                className="latest-episode-card-bg"
                src={episode.episodeThumbnail}
                alt=""
                loading="lazy"
                draggable={false}
            />

            <div className="latest-episode-card-shade" />

            <div className="latest-episode-card-body">
                <p className="latest-episode-card-title">
                    <span>{heading}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                </p>

                <p className="latest-episode-card-sub">
                    Episode {episode.latestEpisode}
                    <span> · </span>
                    English Sub
                </p>

                {episode.nativeTitle && (
                    <p className="latest-episode-card-native">
                        {episode.nativeTitle}
                    </p>
                )}
            </div>

            <div className="latest-episode-card-pills">
                <span className="latest-episode-pill">
                    {episode.providerCount}{" "}
                    {episode.providerCount === 1
                        ? "Provider"
                        : "Providers"}
                </span>

                {rating && (
                    <span className="latest-episode-pill">
                        <span className="latest-episode-pill-star">
                            ★
                        </span>
                        {rating}
                    </span>
                )}
            </div>
        </Link>
    );
}
