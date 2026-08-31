"use client";

import { useState } from "react";
import type { Anime } from "../data/anime";
import {
    Flame,
    CalendarDays,
    Clock3,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

const INITIAL_VISIBLE = 9;
const PAGE_SIZE = 9;
const TOP_LIMIT = 50;

type Period = "day" | "week" | "month";

type TopTenProps = {
    day: Anime[];
    week: Anime[];
    month: Anime[];
};

export default function TopTen({
    day,
    week,
    month,
}: TopTenProps) {
    const [period, setPeriod] = useState<Period>("day");
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

    const rankings = {
        day,
        week,
        month,
    };

    const totalAnime = Math.min(rankings[period].length, TOP_LIMIT);
    const anime = rankings[period].slice(
        0,
        Math.min(visibleCount, totalAnime)
    );

    const selectPeriod = (nextPeriod: Period) => {
        setPeriod(nextPeriod);
        setVisibleCount(INITIAL_VISIBLE);
    };

    return (
        <section className="top-ten-section">
            <div className="top-ten-container">
                <span className="top-ten-corner top-ten-corner-tl" />
                <span className="top-ten-corner top-ten-corner-tr" />
                <span className="top-ten-corner top-ten-corner-bl" />
                <span className="top-ten-corner top-ten-corner-br" />

                <div className="top-ten-header">
                    <div className="top-ten-heading">
                        <span className="top-ten-label">{"///"}</span>
                        <h2>TOP 50</h2>
                    </div>

                    <div className="top-ten-tabs-wrapper">
                        <div className="top-ten-tabs">
                            <button
                                type="button"
                                className={period === "day" ? "active" : ""}
                                onClick={() => selectPeriod("day")}
                            >
                                <Flame size={11} strokeWidth={2} />
                                DAY
                            </button>

                            <button
                                type="button"
                                className={period === "week" ? "active" : ""}
                                onClick={() => selectPeriod("week")}
                            >
                                <CalendarDays size={11} strokeWidth={2} />
                                WEEK
                            </button>

                            <button
                                type="button"
                                className={period === "month" ? "active" : ""}
                                onClick={() => selectPeriod("month")}
                            >
                                <Clock3 size={11} strokeWidth={2} />
                                MONTH
                            </button>
                        </div>

                        <p className="top-ten-ranked-label">
                            {"/// TOP RANKED ANIME"}
                        </p>
                    </div>
                </div>

                <div className="top-ten-grid">
                    {anime.map((item, index) => {
                        const animeWithTvInfo = item as Anime & {
                            tvInfo?: {
                                eps?: number | null;
                                showType?: string | null;
                            };
                        };

                        return (
                            <a
                                key={item.id}
                                href={`/anime/${item.id}`}
                                className="top-ten-card"
                            >
                                <img
                                    src={item.poster}
                                    alt=""
                                    className="top-ten-card-background"
                                />

                                <div className="top-ten-card-overlay" />

                                <div className="top-ten-card-rank">
                                    <span>RNK</span>
                                    <strong>
                                        {String(index + 1).padStart(2, "0")}
                                    </strong>
                                </div>

                                <div className="top-ten-card-content">
                                    <span className="top-ten-card-category">
                                        $ CAT /TOP10/
                                        {String(index + 1).padStart(2, "0")}
                                    </span>

                                    <h3>{item.title}</h3>
                                </div>

                                <span className="top-ten-card-episode">
                                    {animeWithTvInfo.tvInfo?.eps
                                        ? `EP ${animeWithTvInfo.tvInfo.eps}`
                                        : animeWithTvInfo.tvInfo?.showType || "TV"}
                                </span>
                            </a>
                        );
                    })}
                </div>

                {(visibleCount > INITIAL_VISIBLE ||
                    visibleCount < totalAnime) && (
                    <div className="latest-episodes-more top-ten-actions">
                        {visibleCount < totalAnime && (
                            <button
                                type="button"
                                className="latest-episodes-toggle"
                                onClick={() =>
                                    setVisibleCount((current) =>
                                        Math.min(
                                            current + PAGE_SIZE,
                                            totalAnime
                                        )
                                    )
                                }
                            >
                                <ChevronDown
                                    size={13}
                                    aria-hidden="true"
                                />
                                LOAD MORE
                            </button>
                        )}

                        {visibleCount > INITIAL_VISIBLE && (
                            <button
                                type="button"
                                className="latest-episodes-toggle"
                                onClick={() =>
                                    setVisibleCount((current) =>
                                        Math.max(
                                            current - PAGE_SIZE,
                                            INITIAL_VISIBLE
                                        )
                                    )
                                }
                            >
                                <ChevronUp
                                    size={13}
                                    aria-hidden="true"
                                />
                                SHOW LESS
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
