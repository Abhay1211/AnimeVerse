"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
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
            </div>

            <div className="row-rail">
                <button
                    type="button"
                    className="row-nav row-nav-left"
                    onClick={() => scroll("left")}
                    aria-label={`Scroll ${title} left`}
                >
                    <ChevronLeft size={16} />
                </button>

                <div className="row-scroller" ref={scrollerRef}>
                    {anime.slice(0, 20).map((item) => (
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

                <button
                    type="button"
                    className="row-nav row-nav-right"
                    onClick={() => scroll("right")}
                    aria-label={`Scroll ${title} right`}
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </section>
    );
}
