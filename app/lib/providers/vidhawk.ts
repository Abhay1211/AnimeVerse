import type {
    AudioType,
    EpisodeList,
    Provider,
    VideoSource,
} from "./types";

/**
 * VidHawk — Provider 3.
 *
 * VidHawk is an iframe-only provider: it exposes a ready-to-embed player at a
 * deterministic URL keyed by AniList id + episode + audio. There is nothing to
 * search, extract or proxy — `getSources` simply constructs the embed URL and
 * hands it back as an `iframe` source so the watch page mounts it in an
 * <iframe> instead of the custom HLS player used by MegaPlay / Anikoto.
 *
 *   https://vidhawk.buzz/embed/ani/{anilistId}/{episode}/{audio}?server=kari
 */

const VIDHAWK_EMBED_BASE = "https://vidhawk.buzz/embed/ani";
const VIDHAWK_SERVER = "kari";

function buildEmbedUrl(
    anilistId: string,
    episode: number,
    audio: AudioType
): string {
    return (
        `${VIDHAWK_EMBED_BASE}/${encodeURIComponent(anilistId)}/${episode}/${audio}` +
        `?server=${VIDHAWK_SERVER}`
    );
}

const vidhawkProvider: Provider = {
    id: "vidhawk",
    name: "VidHawk",
    category: "vidhawk",
    priority: 3,

    async getEpisodes(_animeId, totalEpisodes): Promise<EpisodeList> {
        // VidHawk has no episode-listing API; the watch UI sources its episode
        // list from AniList/TMDB. Report whatever the caller already knows.
        return {
            episodes: [],
            totalEpisodes:
                totalEpisodes && totalEpisodes > 0 ? totalEpisodes : 0,
        };
    },

    async getSources(
        animeId,
        episode,
        type: AudioType
    ): Promise<VideoSource[]> {
        const anilistId = animeId?.trim() ?? "";

        if (
            !/^\d+$/.test(anilistId) ||
            !Number.isInteger(episode) ||
            episode < 1
        ) {
            return [];
        }

        const audio: AudioType = type === "dub" ? "dub" : "sub";

        return [
            {
                provider: "vidhawk",
                type: audio,
                url: buildEmbedUrl(anilistId, episode, audio),
                kind: "iframe",
            },
        ];
    },
};

export default vidhawkProvider;
