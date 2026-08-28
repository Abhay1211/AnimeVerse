"use client";

import { ArrowLeft, ArrowRight, LayoutGrid, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

type Anime = {
    id: string;
    title: string;
    description: string;
    genres: string[];
    poster: string;
    banner: string | null;
    logo: string | null;
    type?: string;
    episodes?: number | null;
    year?: number | null;
};

type AnimeHeroProps = {
    anime: Anime[];
};

/** Horizontal drag distance (px) that equals moving the carousel one card. */
const DRAG_STEP = 128;
/** Cards rendered on each side of the active card (7-card fan needs ≥ 3). */
const RENDER_RADIUS = 4;

const pad = (n: number) => String(n).padStart(2, "0");

/** AniList descriptions are HTML — flatten to plain text for the hero blurb. */
const stripHtml = (html: string) =>
    html
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

export default function AnimeHero({ anime }: AnimeHeroProps) {
    const router = useRouter();
    const total = anime.length;

    const [activeIndex, setActiveIndex] = useState(0);
    // Fractional offset (in cards) the whole fan is shifted by while dragging.
    const [dragUnits, setDragUnits] = useState(0);
    const [dragging, setDragging] = useState(false);

    const pointerId = useRef<number | null>(null);
    const startX = useRef(0);
    const movedRef = useRef(false);
    const pressedCard = useRef<number | null>(null);

    const renderRadius = Math.min(
        RENDER_RADIUS,
        Math.max(1, Math.floor((total - 1) / 2))
    );

    // Auto-advance, paused while the pointer is down on the carousel.
    useEffect(() => {
        if (total < 2) return;

        const id = window.setInterval(() => {
            if (pointerId.current !== null) return;
            setActiveIndex((i) => (i + 1) % total);
        }, 8000);

        return () => window.clearInterval(id);
    }, [total]);

    const wrap = (i: number) => ((i % total) + total) % total;
    const goTo = (i: number) => setActiveIndex(wrap(i));
    const next = () => goTo(activeIndex + 1);
    const prev = () => goTo(activeIndex - 1);

    /** Signed shortest offset of card `i` from the active card. */
    const circularOffset = (i: number) => {
        let o = i - activeIndex;
        if (o > total / 2) o -= total;
        if (o < -total / 2) o += total;
        return o;
    };

    const onPointerDown = (
        event: ReactPointerEvent<HTMLDivElement>
    ) => {
        if (total < 2) return;

        pointerId.current = event.pointerId;
        startX.current = event.clientX;
        movedRef.current = false;

        const card = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-card-index]"
        );
        pressedCard.current = card
            ? Number(card.dataset.cardIndex)
            : null;

        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (
        event: ReactPointerEvent<HTMLDivElement>
    ) => {
        if (pointerId.current !== event.pointerId) return;

        const dx = event.clientX - startX.current;
        if (Math.abs(dx) > 4) movedRef.current = true;

        const limit = renderRadius - 0.5;
        setDragUnits(
            Math.max(-limit, Math.min(limit, dx / DRAG_STEP))
        );
    };

    const endDrag = (
        event: ReactPointerEvent<HTMLDivElement>
    ) => {
        if (pointerId.current !== event.pointerId) return;

        pointerId.current = null;
        setDragging(false);

        if (!movedRef.current) {
            // A tap, not a drag → focus the tapped card.
            if (
                pressedCard.current !== null &&
                pressedCard.current !== activeIndex
            ) {
                goTo(pressedCard.current);
            }
            setDragUnits(0);
            return;
        }

        // Snap to the card closest to centre.
        const steps = Math.round(dragUnits);
        setDragUnits(0);
        if (steps !== 0) goTo(activeIndex - steps);
    };

    if (total === 0) {
        return (
            <section className="anime-hero">
                <div className="anime-hero-error">Loading...</div>
            </section>
        );
    }

    const activeAnime = anime[activeIndex];
    const description = stripHtml(activeAnime.description || "");
    const genres = activeAnime.genres?.slice(0, 4) ?? [];

    return (
        <section className="anime-hero">
            {/* Background (AniList banner via TMDB, else AniList poster) */}
            <div
                key={activeAnime.id}
                className="anime-hero-background"
                style={{
                    backgroundImage: `url("${activeAnime.banner || activeAnime.poster}")`,
                }}
            />

            <div className="anime-hero-overlay" />

            {/* Featured counters */}
            <div className="anime-hero-counter anime-hero-counter-left">
                FEATURED{" "}
                <span className="anime-hero-counter-sep">/</span>{" "}
                <span className="anime-hero-counter-num">
                    {pad(activeIndex + 1)}
                </span>
            </div>

            <div className="anime-hero-counter anime-hero-counter-right">
                <span className="anime-hero-counter-num">
                    {pad(activeIndex + 1)}
                </span>{" "}
                <span className="anime-hero-counter-sep">/</span>{" "}
                {pad(total)}{" "}
                <span className="anime-hero-counter-total">
                    TOTAL
                </span>
            </div>

            {/* 7-card fan carousel (poster = AniList coverImage.large) */}
            <div
                className={`anime-carousel${
                    dragging ? " is-dragging" : ""
                }`}
                role="group"
                aria-label="Featured anime carousel"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                {anime.map((item, index) => {
                    const base = circularOffset(index);
                    if (Math.abs(base) > renderRadius) return null;

                    const offset = base + dragUnits;
                    const distance = Math.abs(offset);

                    return (
                        <div
                            key={item.id}
                            data-card-index={index}
                            className={`anime-carousel-item${
                                index === activeIndex
                                    ? " active"
                                    : ""
                            }`}
                            style={
                                {
                                    "--offset": offset,
                                    "--distance": distance,
                                } as CSSProperties
                            }
                        >
                            <div className="anime-carousel-card">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={item.poster}
                                    alt=""
                                    draggable={false}
                                    loading={
                                        Math.abs(base) <= 1
                                            ? "eager"
                                            : "lazy"
                                    }
                                />
                                <div className="anime-carousel-card-shade" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Arrows */}
            <div className="anime-hero-controls">
                <button
                    type="button"
                    className="anime-hero-arrow anime-hero-arrow-left"
                    onClick={prev}
                    aria-label="Previous anime"
                >
                    <ArrowLeft size={22} />
                </button>

                <button
                    type="button"
                    className="anime-hero-arrow anime-hero-arrow-right"
                    onClick={next}
                    aria-label="Next anime"
                >
                    <ArrowRight size={22} />
                </button>
            </div>

            {/* Metadata + logo + genres + description */}
            <div className="anime-hero-title">
                <p className="anime-hero-meta">
                    {activeAnime.type && (
                        <span className="anime-hero-meta-pill">
                            <span className="anime-hero-meta-dot" />
                            {activeAnime.type}
                        </span>
                    )}

                    {activeAnime.episodes ? (
                        <>
                            <span className="anime-hero-meta-sep">
                                |
                            </span>
                            <span>{activeAnime.episodes} EP</span>
                        </>
                    ) : null}

                    {activeAnime.year ? (
                        <>
                            <span className="anime-hero-meta-sep">
                                |
                            </span>
                            <span>{activeAnime.year}</span>
                        </>
                    ) : null}
                </p>

                {activeAnime.logo ? (
                    <img
                        src={activeAnime.logo}
                        alt={activeAnime.title}
                        className="anime-hero-logo"
                    />
                ) : (
                    <h1>{activeAnime.title}</h1>
                )}

                {genres.length > 0 && (
                    <p className="anime-hero-genres">
                        {genres.join(" · ")}
                    </p>
                )}

                {description && (
                    <p className="anime-hero-desc">{description}</p>
                )}
            </div>

            {/* Main actions — DO NOT restyle */}
            <div className="anime-hero-actions">
                <button
                    type="button"
                    className="anime-hero-watch"
                    onClick={() =>
                        router.push(`/anime/${activeAnime.id}`)
                    }
                >
                    <Play size={16} fill="currentColor" />

                    <span>WATCH NOW</span>
                </button>

                <button
                    type="button"
                    className="anime-hero-browse"
                    onClick={() => router.push("/browse")}
                >
                    <LayoutGrid size={16} />

                    <span>BROWSE</span>
                </button>
            </div>
        </section>
    );
}
