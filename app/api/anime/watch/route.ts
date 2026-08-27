import { NextResponse } from "next/server";
import {
    getPrimaryProvider,
    getProvider,
    providers,
} from "../../../lib/providers";

import type { AudioType } from "../../../lib/providers/types";

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

        const sources =
            await selectedProvider.getSources(
                animeId,
                episode,
                type
            );

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