"use client";

import { useRef } from "react";
import type { Anime } from "../data/anime";
import AnimeCard from "./AnimeCard";

type AnimeRowProps = {
    title: string;
    label: string;
    anime: Anime[];
};

export default function AnimeRow({
    title,
    label,
    anime,
}: AnimeRowProps) {
    const scrollerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: "left" | "right") => {
        scrollerRef.current?.scrollBy({
            left: direction === "left" ? -400 : 400,
            behavior: "smooth",
        });
    };

    return (
        <section
            className="catalog-row"
            id={
                title === "Trending Now"
                    ? "trending"
                    : title === "Top Rated"
                        ? "top-rated"
                        : undefined
            }
        >
            <div className="row-heading">
                <h2 className="row-title">
                    <span>///</span>
                    {title}
                </h2>

                <div className="row-controls">
                    <button
                        type="button"
                        onClick={() => scroll("left")}
                    >
                        ‹
                    </button>

                    <button
                        type="button"
                        onClick={() => scroll("right")}
                    >
                        ›
                    </button>
                </div>
            </div>

            <div className="row-scroller" ref={scrollerRef}>
                {anime.map((item) => (
                    <AnimeCard
                        key={`${title}-${item.id}`}
                        id={item.id}
                        title={item.title}
                        nativeTitle={item.nativeTitle}
                        image={item.poster}
                        score={item.score ?? undefined}
                        episodes={item.episodes ?? undefined}
                        format={item.type}
                    />
                ))}
            </div>
        </section>
    );
}