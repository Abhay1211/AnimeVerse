"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for failures in the root layout itself. It replaces the
 * entire document, so `globals.css` / Tailwind are NOT available here — the
 * styling is intentionally inline and minimal.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global application error:", error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 20,
                    padding: "64px 24px",
                    background: "#000",
                    color: "#fff",
                    fontFamily:
                        '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    textAlign: "center",
                }}
            >
                <p
                    style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.24em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.35)",
                    }}
                >
                    {"/// error"}
                </p>

                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    AnimeVerse ran into a problem
                </h1>

                <p
                    style={{
                        margin: 0,
                        maxWidth: 360,
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: "rgba(255,255,255,0.45)",
                    }}
                >
                    The app failed to load. Please try again, or reload the page.
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            height: 44,
                            padding: "0 20px",
                            border: 0,
                            borderRadius: 8,
                            background: "#fff",
                            color: "#000",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            cursor: "pointer",
                        }}
                    >
                        Try again
                    </button>

                    {/* A full document load is the right recovery when the root
                        layout itself has failed, so this is a hard navigation
                        rather than a client-side <Link>. */}
                    <button
                        type="button"
                        onClick={() => {
                            window.location.href = "/anime";
                        }}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 44,
                            padding: "0 20px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.18)",
                            background: "transparent",
                            color: "rgba(255,255,255,0.8)",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                        }}
                    >
                        Back to AnimeVerse
                    </button>
                </div>
            </body>
        </html>
    );
}
