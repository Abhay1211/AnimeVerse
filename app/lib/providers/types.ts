export type AudioType = "sub" | "dub";

export type ProviderCategory =
    | "megaplay"
    | "cloudplay"
    | "vidhawk";

export type VideoSourceKind = "iframe" | "direct";

export type VideoSubtitle = {
    url: string;
    language: string;
};

export type VideoSource = {
    provider: string;
    type: AudioType;
    url: string;
    /** How the URL must be mounted by the playback surface. */
    kind?: VideoSourceKind;
    quality?: string;
    subtitles?: VideoSubtitle[];
    /** Request metadata returned by a server-side stream resolver. */
    headers?: Record<string, string>;
    /** Whether the source is an HLS manifest. */
    isHLS?: boolean;
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
