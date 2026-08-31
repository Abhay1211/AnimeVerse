"use client";

import { useEffect } from "react";

import ErrorScreen from "../../components/ErrorScreen";

/**
 * Error boundary for the anime detail route. Expected failures (API says the
 * title doesn't exist) are already handled inside the page; this catches
 * unexpected render/runtime throws.
 */
export default function AnimeDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Anime detail page error:", error);
    }, [error]);

    return (
        <ErrorScreen
            title="Couldn’t load this anime"
            message="Something went wrong while loading this title. Try again, or browse other anime."
            onRetry={reset}
            secondaryHref="/anime"
            secondaryLabel="Browse anime"
        />
    );
}
