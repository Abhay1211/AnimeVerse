export type AudioType = "sub" | "dub";

export type ProviderCategory =
    | "megaplay"
    | "cloudplay"
    | "kiwistream"
    | "streamx"
    | "nexus";

export type VideoSource = {
    provider: string;
    type: AudioType;
    url: string;
    quality?: string;
};

export type AnimeEpisode = {
    number: number;
    title?: string;
    sources: VideoSource[];
};

export type EpisodeList = {
    episodes: AnimeEpisode[];
    totalEpisodes: number;
};

export type Provider = {
    id: string;
    name: string;

    category: ProviderCategory;
    priority: number;

    getEpisodes(
        animeId: string,
        totalEpisodes: number | null
    ): Promise<EpisodeList>;

    getSources(
        animeId: string,
        episode: number,
        type: AudioType
    ): Promise<VideoSource[]>;
};