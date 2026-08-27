import type {
    AudioType,
    AnimeEpisode,
    EpisodeList,
    Provider,
    VideoSource,
} from "./types";

const MEGAPLAY_BASE = "https://megaplay.buzz";

const anikotoProvider: Provider = {
    id: "anikoto",
    name: "MegaPlay",

    category: "megaplay",
    priority: 1,

    async getEpisodes(
        animeId,
        totalEpisodes
    ): Promise<EpisodeList> {
        const total = totalEpisodes ?? 0;

        const episodes: AnimeEpisode[] = Array.from(
            { length: total },
            (_, index) => ({
                number: index + 1,
                sources: [],
            })
        );

        return {
            episodes,
            totalEpisodes: total,
        };
    },

    async getSources(
        animeId,
        episode,
        type: AudioType
    ): Promise<VideoSource[]> {
        if (!animeId || episode < 1) {
            return [];
        }

        return [
            {
                provider: "megaplay",
                type,
                url:
                    `${MEGAPLAY_BASE}/stream/ani/` +
                    `${encodeURIComponent(animeId)}/` +
                    `${episode}/` +
                    `${type}`,
            },
        ];
    },
};

export default anikotoProvider;