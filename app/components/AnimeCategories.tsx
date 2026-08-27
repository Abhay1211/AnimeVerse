"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

const genres = [
    "ACTION",
    "ADVENTURE",
    "COMEDY",
    "DRAMA",
    "ECCHI",
    "FANTASY",
    "HORROR",
    "MAHOU SHOUJO",
    "MECHA",
    "MUSIC",
    "MYSTERY",
    "PSYCHOLOGICAL",
    "ROMANCE",
    "SCI-FI",
    "SLICE OF LIFE",
    "SPORTS",
    "SUPERNATURAL",
    "THRILLER",
];

export default function AnimeCategories() {
    const [selectedGenre, setSelectedGenre] = useState("ALL");
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
            {genres.map((genre) => (
                <button
                    key={genre}
                    type="button"
                    className={`anime-category ${
                        selectedGenre === genre
                            ? "anime-category-active"
                            : ""
                    }`}
                    onClick={() => setSelectedGenre(genre)}
                >
                    {genre}
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