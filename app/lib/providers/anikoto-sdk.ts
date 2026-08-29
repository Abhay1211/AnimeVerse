import {
    AnilistMeta,
    AnikotoProvider,
    FetchTransport,
    HttpClient,
    type IContentUnit,
    type IMediaMetadata,
    type ResolvedMediaStream,
} from "anime-sdk";
import type { AudioType, EpisodeList, Provider, VideoSource } from "./types";

const ANIKOTO_API = "https://anikotoapi.site";
const http = new HttpClient({ timeoutMs: 25_000, transport: new FetchTransport() });
const anikoto = new AnikotoProvider(http);
const anilist = new AnilistMeta(http);
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CATALOG_PAGES = 90;
const CATALOG_PAGE_DELAY_MS = 2_100;

type Cached<T> = { value: T; expiresAt: number };
type CatalogEntry = {
    id?: number | string;
    s_id?: number | string;
    ani_id?: number | string;
};
type CatalogResponse = {
    data?: CatalogEntry[];
    pagination?: { total_pages?: number | string };
};
type SeriesPayload = {
    ok?: boolean;
    data?: {
        anime?: {
            title?: string;
            alternative?: string;
            titles?: string;
            native?: string;
            slug?: string;
            year?: number | string;
            episodes?: number | string;
            mal_id?: number | string;
        };
        episodes?: Array<{
            number?: number | string;
            episode?: number | string;
        }>;
    };
};

const seriesIdCache = new Map<string, Cached<string>>();
const titleIdCache = new Map<string, Cached<string>>();
const catalogPageCache = new Map<number, Promise<Cached<CatalogResponse | null>>>();
let catalogRequestTail = Promise.resolve();
let lastCatalogRequestAt = 0;

function rawId(id: string): string {
    const separator = id.indexOf(":");
    return separator === -1 ? id : id.slice(separator + 1);
}

function normalizeTitle(value: string): string {
    return value
        .toLocaleLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[&+]/g, " and ")
        .replace(/[’'`]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function titleSimilarity(left: string, right: string): number {
    const a = normalizeTitle(left);
    const b = normalizeTitle(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.9;
    const leftTokens = new Set(a.split(" ").filter((token) => token.length > 1));
    const rightTokens = new Set(b.split(" ").filter((token) => token.length > 1));
    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 0 : intersection / union;
}

function metadataTitles(metadata: IMediaMetadata): string[] {
    return [metadata.title.userPreferred, metadata.title.english, metadata.title.romaji, metadata.title.native, ...(metadata.synonyms ?? [])]
        .filter((title): title is string => Boolean(title?.trim()));
}

function seriesTitles(series: SeriesPayload): string[] {
    const anime = series.data?.anime;
    return [anime?.title, anime?.alternative, anime?.titles, anime?.native, anime?.slug]
        .filter((title): title is string => Boolean(title?.trim()));
}

function cachedValue(cache: Map<string, Cached<string>>, key: string): string | null {
    const entry = cache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

async function fetchSeries(seriesId: string): Promise<SeriesPayload | null> {
    try {
        const response = await fetch(`${ANIKOTO_API}/series/${encodeURIComponent(seriesId)}`, {
            signal: AbortSignal.timeout(25_000),
            next: { revalidate: 3600 },
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as SeriesPayload;
        return payload.ok === false ? null : payload;
    } catch {
        return null;
    }
}

function hasEpisode(series: SeriesPayload, episode: number | null): boolean {
    if (episode === null) return (series.data?.episodes?.length ?? 0) > 0;
    return Boolean(series.data?.episodes?.some((item) => Number(item.number ?? item.episode) === episode));
}

function compatibleSeries(metadata: IMediaMetadata, series: SeriesPayload): boolean {
    const anime = series.data?.anime;
    const metadataMal = Number(metadata.mappings?.mal);
    const seriesMal = Number(anime?.mal_id);
    if (metadataMal && seriesMal && metadataMal !== seriesMal) return false;
    const seriesYear = Number(anime?.year);
    if (metadata.year && seriesYear && Math.abs(metadata.year - seriesYear) > 2) return false;

    const metadataEpisodes = metadata.episodeCount ?? 0;
    const seriesEpisodes = Number(anime?.episodes);
    if (metadataEpisodes > 50 && seriesEpisodes > 0 && seriesEpisodes < metadataEpisodes / 4) return false;
    return true;
}

async function searchCatalogue(metadata: IMediaMetadata, episode: number | null): Promise<string | null> {
    const candidates = new Map<string, number>();
    const variants = metadataTitles(metadata);

    for (const title of variants) {
        const cachedId = cachedValue(titleIdCache, normalizeTitle(title));
        if (cachedId) {
            const cachedSeries = await fetchSeries(cachedId);
            if (cachedSeries && compatibleSeries(metadata, cachedSeries) && hasEpisode(cachedSeries, episode)) return cachedId;
        }
    }

    for (const title of variants) {
        try {
            const results = await anikoto.search(title);
            for (const result of results) {
                const id = rawId(result.id);
                const score = Math.max(...variants.map((variant) => titleSimilarity(variant, result.title)));
                if (id && score >= 0.45 && (candidates.get(id) ?? 0) < score) candidates.set(id, score);
            }
        } catch {
            // Continue with other title variants and then the API fallback.
        }
    }

    const ordered = [...candidates.entries()].sort((left, right) => right[1] - left[1]);
    for (const [candidateId] of ordered.slice(0, 30)) {
        const series = await fetchSeries(candidateId);
        if (!series || !compatibleSeries(metadata, series) || !hasEpisode(series, episode)) continue;
        const score = Math.max(...variants.flatMap((title) => seriesTitles(series).map((name) => titleSimilarity(title, name))));
        if (score >= 0.55) return candidateId;
    }
    return null;
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchCatalogPage(page: number): Promise<Cached<CatalogResponse | null>> {
    const cached = catalogPageCache.get(page);
    if (cached) return cached;
    const request = catalogRequestTail.then(async () => {
        const delay = Math.max(0, CATALOG_PAGE_DELAY_MS - (Date.now() - lastCatalogRequestAt));
        if (delay > 0) await wait(delay);
        lastCatalogRequestAt = Date.now();
        try {
            const response = await fetch(`${ANIKOTO_API}/recent-anime?page=${page}&per_page=100`, {
                signal: AbortSignal.timeout(25_000),
                next: { revalidate: 3600 },
            });
            return { value: response.ok ? ((await response.json()) as CatalogResponse) : null, expiresAt: Date.now() + CACHE_TTL_MS };
        } catch {
            return { value: null, expiresAt: Date.now() + 30_000 };
        }
    });
    catalogPageCache.set(page, request);
    catalogRequestTail = request.then(() => undefined, () => undefined);
    return request;
}

async function scanCatalog(animeId: string, episode: number | null): Promise<string | null> {
    const first = await fetchCatalogPage(1);
    const totalPages = Math.min(MAX_CATALOG_PAGES, Math.max(1, Number(first.value?.pagination?.total_pages) || 1));
    for (let page = 1; page <= totalPages; page += 1) {
        const result = page === 1 ? first : await fetchCatalogPage(page);
        const entry = result.value?.data?.find((item) => String(item.ani_id ?? "") === animeId);
        if (!entry) continue;
        const id = entry.id ?? entry.s_id;
        if (id === undefined) return null;
        const seriesId = rawId(String(id));
        const series = await fetchSeries(seriesId);
        return series && hasEpisode(series, episode) ? seriesId : null;
    }
    return null;
}

export async function resolveAnikotoSeriesId(animeId: string, episode: number | null = null): Promise<string | null> {
    const cached = cachedValue(seriesIdCache, animeId);
    if (cached) return cached;
    const metadataId = /^\d+$/.test(animeId) ? `anilist:${animeId}` : null;
    if (!metadataId) return null;
    const metadata = await anilist.fetchMediaInfo(metadataId).catch(() => null);
    if (!metadata) return null;
    const lookup = await searchCatalogue(metadata, episode) ?? await scanCatalog(animeId, episode);
    if (!lookup) return null;
    const expiresAt = Date.now() + CACHE_TTL_MS;
    seriesIdCache.set(animeId, { value: lookup, expiresAt });
    for (const title of metadataTitles(metadata)) titleIdCache.set(normalizeTitle(title), { value: lookup, expiresAt });
    return lookup;
}

function normalizeSources(result: ResolvedMediaStream, type: AudioType): VideoSource[] {
    if (result.type !== "video") return [];
    return result.streams.flatMap((stream) => {
        try {
            const url = new URL(stream.sourceUrl);
            if (!/^https?:$/.test(url.protocol)) return [];
            return [{ provider: "anikoto", type, url: url.href, kind: "direct", quality: stream.quality, isHLS: stream.isHLS, subtitles: stream.subtitles, headers: stream.headers } satisfies VideoSource];
        } catch {
            return [];
        }
    });
}

async function contentUnits(animeId: string, episode: number | null): Promise<IContentUnit[]> {
    const seriesId = await resolveAnikotoSeriesId(animeId, episode);
    return seriesId ? anikoto.fetchContentUnits(`anikoto:${seriesId}`) : [];
}

const anikotoSdkProvider: Provider = {
    id: "anikoto",
    name: "Anikoto",
    category: "cloudplay",
    priority: 2,
    async getEpisodes(animeId, totalEpisodes): Promise<EpisodeList> {
        try {
            const units = await contentUnits(animeId, null);
            return { episodes: units.map((unit) => ({ number: unit.number, title: unit.title, sources: [] })), totalEpisodes: totalEpisodes ?? units.length };
        } catch {
            return { episodes: [], totalEpisodes: 0 };
        }
    },
    async getSources(animeId, episode, type): Promise<VideoSource[]> {
        try {
            const unit = (await contentUnits(animeId, episode)).find((candidate) => candidate.number === episode);
            if (!unit) return [];
            return normalizeSources(await anikoto.resolveStream(unit.id, type), type);
        } catch (error) {
            console.error("Anikoto provider failed:", error);
            return [];
        }
    },
};

export default anikotoSdkProvider;
