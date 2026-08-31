"use client";

import { useEffect } from "react";

import ErrorScreen from "./components/ErrorScreen";

/**
 * Root route-segment error boundary — catches unexpected render/runtime
 * failures on any page that does not have a closer `error.tsx`.
 */
export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Never swallow the real error — surface it for local dev + prod logs.
        console.error("App route error:", error);
    }, [error]);

    return (
        <ErrorScreen
            title="This page hit a snag"
            message="Something broke while loading this page. Try again — if it keeps happening, head back to the app."
            onRetry={reset}
        />
    );
}
