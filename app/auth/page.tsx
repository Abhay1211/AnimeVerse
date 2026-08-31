import { Suspense } from "react";
import type { Metadata } from "next";

import AuthExperience from "./AuthExperience";

export const metadata: Metadata = {
    title: "Sign In · Anime Verse",
    description: "Sign in to AnimeVerse or create an account.",
};

export default function AuthPage() {
    // <AuthExperience> reads the `?mode=` query via useSearchParams, so it has
    // to sit under a Suspense boundary.
    return (
        <Suspense fallback={<main className="auth-page" />}>
            <AuthExperience />
        </Suspense>
    );
}
