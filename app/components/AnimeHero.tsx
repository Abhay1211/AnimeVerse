"use client";

import {
    ArrowLeft,
    ArrowRight,
    Play,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Anime = {
    id: number;
    title: string;
    description: string;
    genres: string[];
    poster: string;
    banner: string;
};

export default function AnimeHero() {
    const [anime, setAnime] = useState<Anime[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const wheelLocked = useRef(false);

    useEffect(() => {
        const loadTrendingAnime = async () => {
            try {
                const response = await fetch("/api/anime/trending");

                if (!response.ok) {
                    throw new Error("Failed to fetch anime");
                }

                const data = await response.json();

                setAnime(data);
            } catch (error) {
                console.error("Failed to load trending anime:", error);
            } finally {
                setLoading(false);
            }
        };

        loadTrendingAnime();
    }, []);

    // Automatically switch anime every 8 seconds.
    useEffect(() => {
        if (anime.length < 2) return;

        const interval = window.setInterval(() => {
            setActiveIndex((current) =>
                current === anime.length - 1 ? 0 : current + 1
            );
        }, 8000);

        return () => window.clearInterval(interval);
    }, [anime.length]);

    const nextAnime = () => {
        setActiveIndex((current) =>
            current === anime.length - 1 ? 0 : current + 1
        );
    };

    const previousAnime = () => {
        setActiveIndex((current) =>
            current === 0 ? anime.length - 1 : current - 1
        );
    };

    // Mouse wheel / trackpad navigation.
    const handleWheel = (event: React.WheelEvent) => {
        if (wheelLocked.current || anime.length < 2) return;

        wheelLocked.current = true;

        if (event.deltaY > 0 || event.deltaX > 0) {
            nextAnime();
        } else {
            previousAnime();
        }

        window.setTimeout(() => {
            wheelLocked.current = false;
        }, 500);
    };

    if (loading) {
        return (
            <section className="anime-hero anime-hero-loading" />
        );
    }

    if (!anime.length) {
        return (
            <section className="anime-hero">
                <div className="anime-hero-error">
                    Unable to load trending anime.
                </div>
            </section>
        );
    }

    const activeAnime = anime[activeIndex];

    return (
        <section className="anime-hero">
            {/* Background */}
            <div
                key={activeAnime.id}
                className="anime-hero-background"
                style={{
                    backgroundImage: `url("${activeAnime.banner}")`,
                }}
            />

            <div className="anime-hero-overlay" />

            {/* Card carousel */}
            <div
                className="anime-carousel"
                onWheel={handleWheel}
            >
                {anime.map((item, index) => {
                    const total = anime.length;

                    let offset = index - activeIndex;

                    // Make the carousel circular.
                    if (offset > total / 2) {
                        offset -= total;
                    }

                    if (offset < -total / 2) {
                        offset += total;
                    }

                    const distance = Math.abs(offset);

                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`anime-carousel-card ${index === activeIndex ? "active" : ""
                                }`}
                            style={
                                {
                                    "--offset": offset,
                                    "--distance": distance,
                                } as React.CSSProperties
                            }
                            onClick={() => setActiveIndex(index)}
                            aria-label={`Select ${item.title}`}
                        >
                            <img
                                src={item.poster}
                                alt={item.title}
                                draggable={false}
                            />

                            <div className="anime-carousel-card-shade" />

                            {index === activeIndex && (
                                <div className="anime-carousel-card-title">
                                    {item.title}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Hidden for now */}
            <div className="anime-hero-title">
                <h1>{activeAnime.title}</h1>

                <div className="anime-hero-genres">
                    {activeAnime.genres.slice(0, 3).map((genre) => (
                        <span key={genre}>{genre}</span>
                    ))}
                </div>
            </div>

            <button
                type="button"
                className="anime-hero-watch"
            >
                <Play size={15} fill="currentColor" />
                <span>WATCH NOW</span>
            </button>

            {/* Carousel controls */}
            <div className="anime-hero-controls">
                <button
                    type="button"
                    onClick={previousAnime}
                    aria-label="Previous anime"
                >
                    <ArrowLeft size={18} />
                </button>

                <div className="anime-hero-dots">
                    {anime.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            className={
                                index === activeIndex
                                    ? "active"
                                    : ""
                            }
                            onClick={() => setActiveIndex(index)}
                            aria-label={`Show ${item.title}`}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={nextAnime}
                    aria-label="Next anime"
                >
                    <ArrowRight size={18} />
                </button>
            </div>
        </section>
    );
}