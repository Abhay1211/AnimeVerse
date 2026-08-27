"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AnimeNavbar from "../../../components/AnimeNavbar";

type AudioType = "sub" | "dub";

type VideoSource = {
    provider: string;
    type: AudioType;
    url: string;
    quality?: string;
};

type WatchResponse = {
    animeId: string;
    episode: number;
    type: AudioType;
    provider: string;
    sources: VideoSource[];
    error?: string;
};

export default function WatchPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const animeId = String(params.id);
    const episode = Number(searchParams.get("episode") ?? "1");
    const type = (searchParams.get("type") ?? "sub") as AudioType;

    const provider = searchParams.get("provider");
    const selectedProvider = provider;
    const router = useRouter();

    const [source, setSource] = useState<VideoSource | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!provider) {
            window.location.replace(`/anime/${animeId}`);
        }
    }, [provider, animeId]);

    useEffect(() => {
        if (!selectedProvider) {
            return;
        }

        const providerId = selectedProvider;

        let cancelled = false;

        async function loadSource() {
            setLoading(true);
            setError(null);
            setSource(null);

            try {
                const providerQuery = `&provider=${encodeURIComponent(providerId)}`;

                const response = await fetch(
                    `/api/anime/watch?id=${encodeURIComponent(
                        animeId
                    )}&episode=${episode}&type=${type}${providerQuery}`
                );

                const data: WatchResponse = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error || "Failed to load episode"
                    );
                }

                const firstSource = data.sources?.[0];

                if (!firstSource) {
                    throw new Error(
                        "No streaming source available"
                    );
                }

                if (!cancelled) {
                    setSource(firstSource);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load episode"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        if (
            animeId &&
            Number.isInteger(episode) &&
            episode > 0 &&
            (type === "sub" || type === "dub")
        ) {
            loadSource();
        } else {
            setError("Invalid episode information");
            setLoading(false);
        }

        return () => {
            cancelled = true;
        };
    }, [animeId, episode, type, selectedProvider]);

    function goBack() {
        router.push(`/anime/${animeId}`);
    }

    return (
        <>
            <AnimeNavbar />

            <main className="min-h-screen bg-black text-white">
                <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col">
                    {/* Header */}
                    <header className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-6">
                        <button
                            type="button"
                            onClick={goBack}
                            className="text-sm text-white/70 transition hover:text-white"
                        >
                            ← Back
                        </button>

                        <div className="text-sm font-medium">
                            Episode {episode} · {type.toUpperCase()}
                        </div>
                    </header>

                    {/* Player */}
                    <section className="relative flex flex-1 flex-col">
                        {/* Player toolbar */}
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
                            <button
                                type="button"
                                onClick={goBack}
                                className="text-xs text-white/50 transition hover:text-white"
                            >
                                ← Change provider
                            </button>

                            <div className="text-xs text-white/50">
                                {selectedProvider ?? "Provider"}
                            </div>
                        </div>

                        {/* Player area */}
                        <div className="relative flex flex-1 items-center justify-center bg-black">
                            {loading && (
                                <div className="text-center">
                                    <div className="mb-3 text-sm text-white/60">
                                        Loading source...
                                    </div>

                                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/20">
                                        {selectedProvider}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="px-6 text-center">
                                    <p className="text-red-400">
                                        {error}
                                    </p>

                                    <p className="mt-2 text-sm text-white/40">
                                        This provider may be unavailable
                                        for this episode.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={goBack}
                                        className="mt-5 border border-white/15 px-4 py-2 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
                                    >
                                        Choose another provider
                                    </button>
                                </div>
                            )}

                            {source && !loading && !error && (
                                <iframe
                                    src={source.url}
                                    title={`Episode ${episode}`}
                                    className="h-[70vh] w-full border-0 md:h-[80vh]"
                                    allowFullScreen
                                    allow="autoplay; fullscreen; picture-in-picture"
                                    referrerPolicy="origin"
                                />
                            )}
                        </div>

                        {/* Player footer */}
                        {source && (
                            <footer className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-white/40 md:px-6">
                                <span>
                                    Provider: {source.provider}
                                </span>

                                {source.quality && (
                                    <span>{source.quality}</span>
                                )}
                            </footer>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}