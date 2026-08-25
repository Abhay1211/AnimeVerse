"use client";

import AnimeHero from "../components/AnimeHero";
import AnimeNavbar from "../components/AnimeNavbar";

export default function AnimePage() {
    return (
        <main className="anime-page">
            <AnimeHero />
            <AnimeNavbar />
        </main>
    );
}