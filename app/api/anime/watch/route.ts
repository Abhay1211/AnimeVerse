import { NextResponse } from "next/server";
import {
    getPrimaryProvider,
    getProvider,
    providers,
} from "../../../lib/providers";

import type {
    AudioType,
    VideoSource,
} from "../../../lib/providers/types";
import { buildSignedProxyUrl } from "../../../lib/megaplay-proxy";

function toMegaPlayProxySource(source: VideoSource): VideoSource {
    try {
        const url = new URL(source.url);
        if (
            url.hostname !== "cdn.kryntal.top" ||
            !url.pathname.startsWith("/anime/")
        ) {
            return source;
        }

        const proxyUrl = buildSignedProxyUrl(
            "http://anime-verse.local",
            url.href,
            source.headers
        );

        return {
            ...source,
            url: proxyUrl,
            // Headers are consumed by the server-side proxy and are not sent
            // to the browser as unnecessary provider internals.
            headers: undefined,
            subtitles: source.subtitles?.map((subtitle) => {
                return {
                    ...subtitle,
                    url: buildSignedProxyUrl(
                        "http://anime-verse.local",
                        subtitle.url,
                        source.headers
                    ),
                };
            }),
        };
    } catch {
        return source;
    }
}

const AUDIO_TYPES: AudioType[] = ["sub", "dub"];

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const animeId = searchParams.get("id")?.trim();
        const episodeValue = searchParams.get("episode");
        const typeValue = searchParams.get("type")?.trim() as
            | AudioType
            | undefined;
        const providerId =
            searchParams.get("provider")?.trim();

        if (!animeId) {
            return NextResponse.json(
                { error: "Anime ID is required" },
                { status: 400 }
            );
        }

        const episode = Number(episodeValue);

        if (
            !Number.isInteger(episode) ||
            episode < 1
        ) {
            return NextResponse.json(
                { error: "Invalid episode number" },
                { status: 400 }
            );
        }

        const type: AudioType =
            typeValue && AUDIO_TYPES.includes(typeValue)
                ? typeValue
                : "sub";

        const primaryProvider =
            getPrimaryProvider();

        const selectedProvider =
            providerId
                ? getProvider(providerId)
                : primaryProvider;

        if (!selectedProvider) {
            return NextResponse.json(
                { error: "Provider not found" },
                { status: 404 }
            );
        }

        let sources =
            await selectedProvider.getSources(
                animeId,
                episode,
                type
            );

        if (selectedProvider.id === "megaplay" || selectedProvider.id === "anikoto") {
            sources = sources.map((source) =>
                toMegaPlayProxySource(source)
            );
        }

        return NextResponse.json({
            animeId,
            episode,
            type,
            selectedProvider: {
                id: selectedProvider.id,
                name: selectedProvider.name,
                category:
                    selectedProvider.category,
                priority:
                    selectedProvider.priority,
            },
            providers: providers.map(
                (provider) => ({
                    id: provider.id,
                    name: provider.name,
                    category:
                        provider.category,
                    priority:
                        provider.priority,
                })
            ),
            sources,
        });
    } catch (error) {
        console.error(
            "Anime watch API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to resolve anime source",
            },
            { status: 500 }
        );
    }
}
