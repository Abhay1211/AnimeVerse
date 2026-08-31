"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

import ErrorScreen from "../../../components/ErrorScreen";

/**
 * Error boundary for the watch route. Provider/source failures are surfaced
 * inside the player itself; this catches unexpected render/runtime throws so
 * the viewer never sees the raw Next.js error screen.
 */
export default function WatchError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const params = useParams();
    const animeId = typeof params?.id === "string" ? params.id : null;

    useEffect(() => {
        console.error("Watch page error:", error);
    }, [error]);

    return (
        <ErrorScreen
            title="Playback page failed to load"
            message="Something went wrong loading this episode page. Try again, or go back to the anime."
            onRetry={reset}
            secondaryHref={animeId ? `/anime/${encodeURIComponent(animeId)}` : "/anime"}
            secondaryLabel={animeId ? "Back to anime" : "Browse anime"}
        />
    );
}
