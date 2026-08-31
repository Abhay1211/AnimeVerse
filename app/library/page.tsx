import { Suspense } from "react";
import type { Metadata } from "next";

import AnimeNavbar from "../components/AnimeNavbar";
import LibraryView from "./LibraryView";

export const metadata: Metadata = {
    title: "My List · Anime Verse",
    description: "Your anime library — everything you're watching, planning and tracking.",
};

export default function LibraryPage() {
    // <LibraryView> reads the `?filter=` query via useSearchParams, so it sits
    // under a Suspense boundary.
    return (
        <Suspense
            fallback={
                <>
                    <AnimeNavbar />
                    <main className="library-page">
                        <div className="anime-browse-loading">LOADING…</div>
                    </main>
                </>
            }
        >
            <LibraryView />
        </Suspense>
    );
}
