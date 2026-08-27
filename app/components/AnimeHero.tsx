"use client";

import {
    ArrowLeft,
    ArrowRight,
    LayoutGrid,
    Play,
} from "lucide-react";
import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent,
} from "react";

type Anime = {
    id: string;
    title: string;
    description: string;
    genres: string[];
    poster: string;
    banner: string | null;
    logo: string | null;
};

type AnimeHeroProps = {
    anime: Anime[];
};

export default function AnimeHero({ anime }: AnimeHeroProps) {
    const [activeIndex, setActiveIndex] = useState(0);

    // Drag state
    const dragStartX = useRef(0);
    const dragCurrentX = useRef(0);
    const isDragging = useRef(false);
    const draggedIndex = useRef<number | null>(null);

    const [dragX, setDragX] = useState(0);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    /*
     * Automatically change anime every 8 seconds.
     * Pause while dragging.
     */
    useEffect(() => {
        if (anime.length < 2) return;

        const interval = window.setInterval(() => {
            if (isDragging.current) return;

            setActiveIndex((current) =>
                current === anime.length - 1
                    ? 0
                    : current + 1
            );
        }, 8000);

        return () => window.clearInterval(interval);
    }, [anime.length]);

    /*
     * Carousel navigation.
     */
    const nextAnime = () => {
        setActiveIndex((current) =>
            current === anime.length - 1
                ? 0
                : current + 1
        );
    };

    const previousAnime = () => {
        setActiveIndex((current) =>
            current === 0
                ? anime.length - 1
                : current - 1
        );
    };
    /*
     * Start grabbing a card.
     */
    const handlePointerDown = (
        event: PointerEvent<HTMLButtonElement>,
        index: number
    ) => {
        if (anime.length < 2) return;

        isDragging.current = true;

        dragStartX.current = event.clientX;
        dragCurrentX.current = event.clientX;

        draggedIndex.current = index;
        setDraggingIndex(index);
        setDragX(0);

        event.currentTarget.setPointerCapture(
            event.pointerId
        );
    };

    /*
     * Card follows the pointer while being grabbed.
     */
    const handlePointerMove = (
        event: PointerEvent<HTMLButtonElement>
    ) => {
        if (!isDragging.current) return;

        dragCurrentX.current = event.clientX;

        const distance =
            event.clientX - dragStartX.current;

        setDragX(distance);
    };

    /*
     * Release the card.
     */
    const handlePointerUp = () => {
        if (!isDragging.current) return;

        const distance =
            dragCurrentX.current - dragStartX.current;

        const index = draggedIndex.current;

        isDragging.current = false;
        draggedIndex.current = null;

        // Small movement = just release the card.
        if (
            Math.abs(distance) < 50 ||
            index === null
        ) {
            setDraggingIndex(null);
            setDragX(0);
            return;
        }

        const total = anime.length;

        let offset = index - activeIndex;

        // Keep the carousel circular.
        if (offset > total / 2) {
            offset -= total;
        }

        if (offset < -total / 2) {
            offset += total;
        }

        /*
         * First change the active card while the dragged
         * position is still visible.
         */
        setActiveIndex(() => {
            let next = activeIndex + offset;

            if (next < 0) {
                next += total;
            }

            if (next >= total) {
                next -= total;
            }

            return next;
        });

        /*
         * Let CSS animate the dragged card back into
         * its new carousel position.
         */
        setDraggingIndex(null);
        setDragX(0);
    };

    if (!anime.length) {
        return (
            <section className="anime-hero">
                <div className="anime-hero-error">
                    Loading...
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
                    backgroundImage: `url("${activeAnime.banner || activeAnime.poster}")`,
                }}
            />

            <div className="anime-hero-overlay" />

            {/* Anime carousel */}
            <div className="anime-carousel">
                {anime.map((item, index) => {
                    const total = anime.length;

                    let offset =
                        index - activeIndex;

                    /*
                     * Make carousel circular.
                     */
                    if (offset > total / 2) {
                        offset -= total;
                    }

                    if (offset < -total / 2) {
                        offset += total;
                    }

                    const distance = Math.abs(offset);

                    if (distance > 2) return null;

                    const isDraggingCard =
                        draggingIndex === index;

                    return (
                        <div
                            key={item.id}
                            className={`anime-carousel-item ${index === activeIndex
                                ? "active"
                                : ""
                                } ${isDraggingCard
                                    ? "is-dragging"
                                    : ""
                                }`}
                            style={
                                {
                                    "--offset": offset,
                                    "--distance": distance,
                                    "--drag-x":
                                        draggingIndex === index
                                            ? `${dragX}px`
                                            : "0px",
                                } as CSSProperties
                            }
                        >
                            <button
                                type="button"
                                className={`anime-carousel-card ${isDraggingCard
                                    ? "is-dragging"
                                    : ""
                                    }`}
                                onPointerDown={(event) =>
                                    handlePointerDown(
                                        event,
                                        index
                                    )
                                }
                                onPointerMove={
                                    handlePointerMove
                                }
                                onPointerUp={
                                    handlePointerUp
                                }
                                onPointerCancel={
                                    handlePointerUp
                                }
                                aria-label={`Drag ${item.title}`}
                            >
                                <img
                                    src={item.poster}
                                    alt={item.title}
                                    draggable={false}
                                />

                                <div className="anime-carousel-card-shade" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Carousel arrows */}
            <div className="anime-hero-controls">
                <button
                    type="button"
                    className="anime-hero-arrow anime-hero-arrow-left"
                    onClick={previousAnime}
                    aria-label="Previous anime"
                >
                    <ArrowLeft size={22} />
                </button>

                <button
                    type="button"
                    className="anime-hero-arrow anime-hero-arrow-right"
                    onClick={nextAnime}
                    aria-label="Next anime"
                >
                    <ArrowRight size={22} />
                </button>
            </div>

            {/* Anime logo / title */}
            <div className="anime-hero-title">
                {activeAnime.logo ? (
                    <img
                        src={activeAnime.logo}
                        alt={activeAnime.title}
                        className="anime-hero-logo"
                    />
                ) : (
                    <h1>{activeAnime.title}</h1>
                )}
            </div>

            {/* Main actions */}
            <div className="anime-hero-actions">
                <button
                    type="button"
                    className="anime-hero-watch"
                >
                    <Play
                        size={16}
                        fill="currentColor"
                    />

                    <span>WATCH NOW</span>
                </button>

                <button
                    type="button"
                    className="anime-hero-browse"
                >
                    <LayoutGrid size={16} />

                    <span>BROWSE</span>
                </button>
            </div>
        </section>
    );
}