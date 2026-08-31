"use client";

import Link from "next/link";
import { RotateCw } from "lucide-react";

/**
 * Shared presentational shell for the App Router `error.tsx` boundaries.
 *
 * Kept dependency-free of the error objects themselves — each boundary logs
 * its own error and passes a `reset` handler here. Styling follows the
 * existing AnimeVerse dark / JetBrains Mono language (same tokens the watch
 * page and auth screens use).
 */
export default function ErrorScreen({
    title = "Something went wrong",
    message = "An unexpected error interrupted this page. You can try again, or head back.",
    onRetry,
    homeHref = "/anime",
    homeLabel = "Back to AnimeVerse",
    secondaryHref,
    secondaryLabel,
}: {
    title?: string;
    message?: string;
    onRetry?: () => void;
    homeHref?: string;
    homeLabel?: string;
    secondaryHref?: string;
    secondaryLabel?: string;
}) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-16 text-center text-white">
            <div className="w-full max-w-sm">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-white/35">
                    {"/// error"}
                </p>

                <h1 className="mt-4 font-mono text-xl font-bold tracking-tight text-white">
                    {title}
                </h1>

                <p className="mt-3 font-mono text-[12px] leading-relaxed text-white/45">
                    {message}
                </p>

                <div className="mt-7 flex flex-col items-stretch gap-2.5">
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white font-mono text-xs font-bold tracking-wide text-black transition hover:bg-white/90 active:scale-[0.99]"
                        >
                            <RotateCw className="h-4 w-4" />
                            Try again
                        </button>
                    )}

                    {secondaryHref && secondaryLabel && (
                        <Link
                            href={secondaryHref}
                            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 font-mono text-xs font-medium text-white/75 transition hover:border-white/30 hover:text-white"
                        >
                            {secondaryLabel}
                        </Link>
                    )}

                    <Link
                        href={homeHref}
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 font-mono text-xs font-medium text-white/75 transition hover:border-white/30 hover:text-white"
                    >
                        {homeLabel}
                    </Link>
                </div>
            </div>
        </main>
    );
}
