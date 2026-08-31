import {
    AnilistMeta,
    FetchTransport,
    HttpClient,
    MappingClient,
    MegaPlayProvider,
    type ResolvedMediaStream,
} from "anime-sdk";
import type {
    AudioType,
    AnimeEpisode,
    EpisodeList,
    Provider,
    VideoSource,
} from "./types";

/**
 * Server-only MegaPlay adapter backed by anime-sdk.
 *
 * Anime Verse routes use AniList's numeric id. The SDK metadata layer turns
 * that into `anilist:<id>`, then MappingClient/MegaPlayProvider resolves the
 * provider-native media id before episodes or streams are requested.
 */

const http = new HttpClient({
    timeoutMs: 25_000,
    transport: new FetchTransport(),
});
const megaplay = new MegaPlayProvider(http);
const metadata = new AnilistMeta(http, {
    mappingClient: new MappingClient(http),
});

function toAniListUrn(animeId: string): string | null {
    const normalized = animeId.trim();
    return /^\d+$/.test(normalized)
        ? `anilist:${normalized}`
        : null;
}

function toVideoSource(
    stream: Extract<ResolvedMediaStream, { type: "video" }>["streams"][number],
    type: AudioType
): VideoSource | null {
    try {
        const url = new URL(stream.sourceUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }

        const subtitles = (stream.subtitles ?? [])
            .filter((subtitle) => {
                try {
                    const subtitleUrl = new URL(subtitle.url);
                    return (
                        subtitleUrl.protocol === "http:" ||
                        subtitleUrl.protocol === "https:"
                    );
                } catch {
                    return false;
                }
            })
            .map((subtitle) => ({
                url: subtitle.url,
                language: subtitle.label || subtitle.language,
            }));

        return {
            provider: "megaplay",
            type,
            url: stream.sourceUrl,
            kind: "direct",
            quality: stream.quality,
            isHLS: stream.isHLS,
            ...(subtitles.length > 0 ? { subtitles } : {}),
            ...(stream.headers ? { headers: stream.headers } : {}),
        };
    } catch {
        return null;
    }
}

async function fetchUnits(animeId: string) {
    const metaUrn = toAniListUrn(animeId);
    if (!metaUrn) return [];

    return metadata.fetchContentUnits(metaUrn, megaplay);
}

const megaplaySdkProvider: Provider = {
    id: "megaplay",
    name: "MegaPlay",
    category: "megaplay",
    priority: 1,

    async getEpisodes(
        animeId: string,
        totalEpisodes: number | null
    ): Promise<EpisodeList> {
        try {
            const units = await fetchUnits(animeId);
            const episodes: AnimeEpisode[] = units.map((unit) => ({
                number: unit.number,
                ...(unit.title ? { title: unit.title } : {}),
                sources: [],
            }));

            return {
                episodes,
                totalEpisodes:
                    episodes.length > 0
                        ? episodes.length
                        : totalEpisodes && totalEpisodes > 0
                        ? totalEpisodes
                        : 0,
            };
        } catch (error) {
            console.error("MegaPlay SDK episode resolution failed:", error);
            return { episodes: [], totalEpisodes: 0 };
        }
    },

    async getSources(
        animeId: string,
        episode: number,
        type: AudioType
    ): Promise<VideoSource[]> {
        if (!toAniListUrn(animeId) || !Number.isInteger(episode) || episode < 1) {
            return [];
        }

        try {
            // MegaPlay is addressed directly by (AniList id, episode): the SDK
            // builds unit ids as `megaplay:<anilistId>:<episode>` and resolves the
            // stream straight from that pair via /stream/ani/<anilistId>/<episode>.
            // Its episode listing under-reports ongoing series (it trusts
            // AniList `Media.episodes`, which is null for e.g. One Piece, so
            // fetchContentUnits yields a single stub episode), so stream
            // resolution must not be gated on fetchUnits(). This mirrors the
            // pre-SDK MegaPlay adapter, which hit the embed endpoint directly.
            const unitUrn = `megaplay:${animeId.trim()}:${episode}`;

            const resolved = await megaplay.resolveStream(unitUrn, type);
            if (resolved.type !== "video") return [];

            return resolved.streams
                .map((stream) => toVideoSource(stream, type))
                .filter((source): source is VideoSource => source !== null);
        } catch (error) {
            console.error(
                "MegaPlay SDK stream resolution failed:",
                { animeId, episode, type },
                error
            );
            return [];
        }
    },
};

export default megaplaySdkProvider;
