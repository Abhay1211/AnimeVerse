import {
    AnikotoProvider,
    FetchTransport,
    HttpClient,
} from "anime-sdk";

const API_BASE = "https://anikotoapi.site";
const TARGET_SLUG = "one-piece-odmau";
const TARGET_ANILIST_ID = "21";
const MAX_REQUESTS = 60;
const REQUEST_DELAY_MS = 2_100;
const sdkProvider = new AnikotoProvider(
    new HttpClient({
        timeoutMs: 25_000,
        transport: new FetchTransport(),
    })
);

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asId(value: unknown): string | null {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return String(value);
    }
    return asString(value);
}

function asNumber(value: unknown): number | null {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function unwrapData(payload: unknown): unknown {
    const object = asObject(payload);
    return object?.data ?? payload;
}

function getPagination(payload: unknown): JsonObject | null {
    const object = asObject(payload);
    return asObject(object?.pagination) || asObject(asObject(object?.data)?.pagination);
}

function findEpisode(value: unknown): JsonObject | null {
    if (Array.isArray(value)) {
        for (const item of value) {
            const episode = findEpisode(item);
            if (episode) return episode;
        }
        return null;
    }

    const object = asObject(value);
    if (!object) return null;

    const number =
        asNumber(object.episode) ||
        asNumber(object.number) ||
        asNumber(object.episode_number) ||
        asNumber(object.ep_num);
    if (number === 1) return object;

    for (const child of Object.values(object)) {
        const episode = findEpisode(child);
        if (episode) return episode;
    }
    return null;
}

function findEmbedUrl(episode: JsonObject, language: "sub" | "dub"): string | null {
    const embedUrl = asObject(episode.embed_url);
    return (
        asString(embedUrl?.[language]) ||
        asString(episode[`${language}_url`]) ||
        asString(episode[`${language}_embed_url`])
    );
}

function findEmbedId(episode: JsonObject): string | null {
    return (
        asString(episode.episode_embed_id) ||
        asString(episode.embed_id) ||
        asString(episode.episode_id)
    );
}

function classifyResponse(
    url: string,
    contentType: string,
    body: string
): string {
    if (body.trimStart().startsWith("#EXTM3U") || /\.m3u8(?:$|[?#])/i.test(url)) {
        return "HLS";
    }
    if (contentType.includes("video/mp4") || /\.mp4(?:$|[?#])/i.test(url)) {
        return "MP4";
    }
    if (/<iframe\b/i.test(body) || /<html\b/i.test(body)) {
        return "EMBED";
    }
    return "UNKNOWN";
}

function firstNestedEmbed(body: string, baseUrl: string): string | null {
    const match = body.match(/(?:src|data-src)=["']([^"']+)["']/i);
    if (!match?.[1]) return null;
    try {
        return new URL(match[1], baseUrl).href;
    } catch {
        return null;
    }
}

async function fetchJson(path: string): Promise<{ payload: unknown; response: Response }> {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(25_000),
    });
    const text = await response.text();
    let payload: unknown = null;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error(`Non-JSON response from ${path} (HTTP ${response.status})`);
    }
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${path}: ${text.slice(0, 240)}`);
    }
    return { payload, response };
}

async function locateOnePiece(): Promise<JsonObject> {
    let requests = 0;
    const first = await fetchJson("/recent-anime?page=1&per_page=100");
    requests++;
    const pagination = getPagination(first.payload);
    const totalPages = asNumber(pagination?.total_pages) || 1;
    const firstData = unwrapData(first.payload);
    const firstResults = Array.isArray(firstData) ? firstData : [];
    const pages = [1, ...Array.from({ length: totalPages }, (_, index) => totalPages - index)].filter(
        (page, index, all) => page > 0 && all.indexOf(page) === index
    );

    for (const page of pages) {
        const payload = page === 1
            ? first.payload
            : (await (async () => {
                await sleep(REQUEST_DELAY_MS);
                requests++;
                if (requests > MAX_REQUESTS) {
                    throw new Error(`Catalog scan reached safety limit of ${MAX_REQUESTS} requests`);
                }
                return (await fetchJson(`/recent-anime?page=${page}&per_page=100`)).payload;
            })());
        const data = unwrapData(payload);
        const entries = Array.isArray(data) ? data : [];
        const match = [...entries, ...(page === 1 ? firstResults : [])]
            .map(asObject)
            .find((entry) => {
                if (!entry) return false;
                const slug = asString(entry.slug)?.toLowerCase();
                const aniId = asString(entry.ani_id);
                return slug === TARGET_SLUG || aniId === TARGET_ANILIST_ID;
            });

        console.log(`CATALOG PAGE ${page}/${totalPages}: ${entries.length} entries`);
        if (match) {
            console.log(`CATALOG MATCH: ${asString(match.title) || "One Piece"}`);
            return match;
        }
    }

    throw new Error(`One Piece slug ${TARGET_SLUG} / AniList ID ${TARGET_ANILIST_ID} was not found`);
}

async function inspectEmbed(
    language: "sub" | "dub",
    url: string,
    episodeEmbedId: string | null
): Promise<{ type: string; playable: boolean; nested?: string; error?: string }> {
    try {
        const response = await fetch(url, {
            headers: {
                Referer: "https://anikototv.to/",
                "User-Agent": "Mozilla/5.0",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(25_000),
        });
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        const body = await response.text();
        const type = classifyResponse(response.url, contentType, body);
        if (type === "HLS" || type === "MP4") {
            return { type, playable: response.ok };
        }

        if (new URL(response.url).hostname === "megaplay.buzz" && episodeEmbedId) {
            const resolved = await sdkProvider.resolveStream(
                `anikoto:${episodeEmbedId}`,
                language
            );
            if (resolved.type === "video" && resolved.streams.length > 0) {
                const stream = resolved.streams[0];
                const sourceResponse = await fetch(stream.sourceUrl, {
                    headers: stream.headers,
                    signal: AbortSignal.timeout(25_000),
                });
                const sourceContentType =
                    (sourceResponse.headers.get("content-type") || "").toLowerCase();
                const sourceBody = await sourceResponse.text();
                const resolvedType = classifyResponse(
                    sourceResponse.url,
                    sourceContentType,
                    sourceBody
                );
                return {
                    type: resolvedType,
                    playable:
                        sourceResponse.ok &&
                        (resolvedType === "HLS" || resolvedType === "MP4"),
                    nested: "megaplay.buzz",
                    ...(sourceResponse.ok
                        ? {}
                        : { error: `Resolved source HTTP ${sourceResponse.status}` }),
                };
            }
        }

        const nested = firstNestedEmbed(body, response.url);
        if (!nested) return { type, playable: false, nested: "megaplay.buzz" };

        const nestedResponse = await fetch(nested, {
            headers: {
                Referer: response.url,
                "User-Agent": "Mozilla/5.0",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(25_000),
        });
        const nestedContentType = (nestedResponse.headers.get("content-type") || "").toLowerCase();
        const nestedBody = await nestedResponse.text();
        const nestedType = classifyResponse(nestedResponse.url, nestedContentType, nestedBody);
        return {
            type: `${type} -> ${nestedType}`,
            playable:
                nestedResponse.ok &&
                (nestedType === "HLS" || nestedType === "MP4"),
            nested: new URL(nestedResponse.url).hostname,
        };
    } catch (error) {
        return { type: "UNKNOWN", playable: false, error: `${language}: ${errorMessage(error)}` };
    }
}

async function main(): Promise<void> {
    console.log("PROVIDER: Anikoto");
    console.log("ANIME: One Piece");
    console.log("ANILIST ID: 21");

    const catalogEntry = await locateOnePiece();
    const anikotoId = asId(catalogEntry.id) || asId(catalogEntry.s_id);
    if (!anikotoId) throw new Error("Catalog match did not contain an Anikoto series id");
    console.log(`ANIKOTO SERIES ID: ${anikotoId}`);

    const seriesResult = await fetchJson(`/series/${encodeURIComponent(anikotoId)}`);
    const series = unwrapData(seriesResult.payload);
    console.log("SERIES LOOKUP: PASS");

    const episode = findEpisode(series);
    console.log(`EPISODE 1: ${episode ? "PASS" : "FAIL"}`);
    if (!episode) throw new Error("Series response did not contain Episode 1");

    console.log(`EPISODE NUMBER: ${asNumber(episode.episode) || asNumber(episode.number) || 1}`);
    console.log(`EPISODE EMBED ID: ${findEmbedId(episode) || "MISSING"}`);

    const results: Record<string, { type: string; playable: boolean; nested?: string; error?: string }> = {};
    for (const language of ["sub", "dub"] as const) {
        const url = findEmbedUrl(episode, language);
        console.log(`${language.toUpperCase()}: ${url ? "FOUND" : "MISSING"}`);
        if (url) {
            results[language] = await inspectEmbed(
                language,
                url,
                findEmbedId(episode)
            );
        }
    }

    const playable = Object.values(results).find((result) => result.playable);
    const firstError = Object.values(results).find((result) => result.error)?.error;
    console.log("\nRESOLUTION:");
    console.log(`PASS/FAIL: ${playable ? "PASS" : "FAIL"}`);
    console.log(`SOURCE TYPE: ${playable?.type || Object.values(results)[0]?.type || "UNKNOWN"}`);
    console.log(`PLAYABLE: ${playable ? "YES" : "NO"}`);
    console.log(`ERROR: ${firstError || (playable ? "None" : "Embed did not resolve to a direct playable source")}`);
    for (const [language, result] of Object.entries(results)) {
        console.log(`${language.toUpperCase()} SOURCE: ${result.type}; PLAYABLE=${result.playable ? "YES" : "NO"}${result.nested ? `; NESTED_HOST=${result.nested}` : ""}`);
    }
}

main().catch((error) => {
    console.error(`ERROR: ${errorMessage(error)}`);
    process.exitCode = 1;
});
