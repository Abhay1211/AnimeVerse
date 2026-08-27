"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type AnimeCardProps = {
    id: string;
    title: string;
    nativeTitle?: string;
    image: string;
    score?: number;
    episodes?: number;
    format?: string;
};

export default function AnimeCard({
    id,
    title,
    nativeTitle,
    image,
    score,
    episodes,
    format,
}: AnimeCardProps) {
    const router = useRouter();

    const openAnime = () => {
        router.push(`/anime/${id}`);
    };

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

                {score !== undefined && (
                    <span className="anime-card-badge anime-card-score">
                        <span className="anime-card-star">★</span>
                        {score}%
                    </span>
                )}

                {(format || episodes) && (
                    <span className="anime-card-badge anime-card-format">
                        {format || `EP ${episodes}`}
                    </span>
                )}
            </div>

            <div className="anime-card-content">
                <h3>{title}</h3>

                {nativeTitle && <p>{nativeTitle}</p>}

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
            </div>
        </article>
    );
}