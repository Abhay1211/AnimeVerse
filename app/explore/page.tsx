"use client";

import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Film,
    Play,
    Sparkles,
} from "lucide-react";
import { useState } from "react";

const destinations = [
    {
        title: "Watch Anime",
        description: "Discover anime series, seasons, and your next favorite story.",
        icon: Play,
        href: "/anime",
        available: true,
        video: "/explore/anime.mp4",
    },
    {
        title: "Read Manga",
        description: "Explore manga and manhwa from your favorite stories.",
        icon: BookOpen,
        href: "/manga",
        available: false,
        video: null,
    },
    {
        title: "Movies",
        description: "Discover movies and cinematic stories.",
        icon: Film,
        href: "/movies",
        available: false,
        video: "/explore/movies.mp4",
    },
    {
        title: "Anime AI",
        description: "Discover a smarter way to explore the anime world.",
        icon: Sparkles,
        href: "/ai",
        available: false,
        video: null,
    },
];

export default function ExplorePage() {
    const [activeVideo, setActiveVideo] = useState<string | null>(null);

    return (
        <main className="explore-page">
            {activeVideo && (
                <video
                    key={activeVideo}
                    className="explore-background-video"
                    src={activeVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                />
            )}

            <div className="explore-video-overlay" />
            <a href="/" className="explore-back">
                <ArrowLeft size={18} />
                <span>Back</span>
            </a>
            <div className="explore-page-glow" />

            <section className="explore-container">
                <div className="explore-heading">
                    <span className="explore-eyebrow">ANIMEVERSE</span>

                    <h1>
                        What would you like
                        <br />
                        to explore?
                    </h1>

                    <p>Choose your destination.</p>
                </div>

                <div className="explore-destinations">
                    {destinations.map((destination) => {
                        const Icon = destination.icon;

                        if (!destination.available) {
                            return (
                                <div
                                    key={destination.title}
                                    className="explore-destination disabled"
                                    onMouseEnter={() => setActiveVideo(destination.video)}
                                    onMouseLeave={() => setActiveVideo(null)}
                                >
                                    <span className="explore-coming-soon">
                                        COMING SOON
                                    </span>

                                    <div className="explore-destination-icon">
                                        <Icon size={26} />
                                    </div>

                                    <div className="explore-destination-content">
                                        <h2>{destination.title}</h2>
                                        <p>{destination.description}</p>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <a
                                key={destination.title}
                                href={destination.href}
                                className="explore-destination"
                                onMouseEnter={() => setActiveVideo(destination.video)}
                                onMouseLeave={() => setActiveVideo(null)}
                            >
                                <div className="explore-destination-icon">
                                    <Icon size={26} />
                                </div>

                                <div className="explore-destination-content">
                                    <span className="explore-destination-number">
                                        01
                                    </span>

                                    <h2>{destination.title}</h2>
                                    <p>{destination.description}</p>
                                </div>

                                <div className="explore-destination-arrow">
                                    <ArrowRight size={20} />
                                </div>
                            </a>
                        );
                    })}
                </div>

                <div className="explore-footer">
                    <span>WATCH</span>
                    <i>•</i>
                    <span>EXPLORE</span>
                    <i>•</i>
                    <span>IMMERSE</span>
                </div>
            </section>
        </main>
    );
}