"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatEpisodeMeta, formatScore } from "../data/anime";

type AnimeCardProps = {
    id: string;
    title: string;
    nativeTitle?: string;
    image: string;
    score?: number;
    episodes?: number;
    format?: string;
    /**
     * "grid" (default) → poster card with native title + WATCH button.
     * "list"           → compact row: title + "TV · SUB N" meta, no WATCH.
     */
    layout?: "grid" | "list";
};

export default function AnimeCard({
    id,
    title,
    nativeTitle,
    image,
    score,
    episodes,
    format,
    layout = "grid",
}: AnimeCardProps) {
    const router = useRouter();

    const openAnime = () => {
        router.push(`/anime/${id}`);
    };

    const rating = formatScore(score);
    const meta = formatEpisodeMeta(format, episodes);

    return (
        <article
            className="anime-card"
            onClick={openAnime}
            role="link"
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openAnime();
                }
            }}
        >
            {/* OUTER CARD CORNERS */}
            <span className="anime-card-frame-corner top-left">+</span>
            <span className="anime-card-frame-corner top-right">+</span>
            <span className="anime-card-frame-corner bottom-left">+</span>
            <span className="anime-card-frame-corner bottom-right">+</span>

            <div className="anime-card-image">
                <img src={image} alt={title} />

                {rating && (
                    <span className="anime-card-badge anime-card-score">
                        <span className="anime-card-star">★</span>
                        {rating}
                    </span>
                )}

                {meta && (
                    <span className="anime-card-badge anime-card-format">
                        {meta}
                    </span>
                )}
            </div>

            <div className="anime-card-content">
                <h3>{title}</h3>

                {layout === "list" ? (
                    (format || episodes) && (
                        <p className="anime-card-meta">
                            {format && (
                                <span className="anime-card-type">
                                    {format}
                                </span>
                            )}
                            {episodes &&
                            format?.toUpperCase() !== "MOVIE" ? (
                                <span>SUB {episodes}</span>
                            ) : null}
                        </p>
                    )
                ) : (
                    nativeTitle && <p>{nativeTitle}</p>
                )}

                {layout !== "list" && (
                    <Link
                        href={`/anime/${id}`}
                        className="anime-card-watch"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <span className="anime-card-watch-bottom-left">+</span>
                        <span className="anime-card-watch-bottom-right">+</span>

                        <span>WATCH</span>

                        <span className="anime-card-arrows">
                            &gt;&gt;&gt;
                        </span>
                    </Link>
                )}
            </div>
        </article>
    );
}