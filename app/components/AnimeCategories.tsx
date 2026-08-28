"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { GENRES } from "../data/genres";

export default function AnimeCategories() {
    const router = useRouter();
    const categoriesRef = useRef<HTMLDivElement>(null);

    const scrollCategories = (direction: "left" | "right") => {
        categoriesRef.current?.scrollBy({
            left: direction === "right" ? 300 : -300,
            behavior: "smooth",
        });
    };

    return (
    <section className="anime-categories" aria-label="Anime genres">
        <button
            type="button"
            className="anime-category-arrow anime-category-arrow-left"
            onClick={() => scrollCategories("left")}
            aria-label="Previous genres"
        >
            <ChevronLeft size={18} />
        </button>

        <div
            ref={categoriesRef}
            className="anime-categories-track"
        >
            {GENRES.map((genre) => (
                <button
                    key={genre}
                    type="button"
                    className="anime-category"
                    onClick={() =>
                        router.push(
                            `/genre/${encodeURIComponent(genre)}`
                        )
                    }
                >
                    {genre.toUpperCase()}
                </button>
            ))}
        </div>

        <button
            type="button"
            className="anime-category-arrow anime-category-arrow-right"
            onClick={() => scrollCategories("right")}
            aria-label="Next genres"
        >
            <ChevronRight size={18} />
        </button>
    </section>
);
}
