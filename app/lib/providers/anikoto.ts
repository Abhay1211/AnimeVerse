import type {
    AudioType,
    AnimeEpisode,
    EpisodeList,
    Provider,
    VideoSource,
} from "./types";

/**
 * Provider 1 — MegaPlay (a.k.a. Anikoto).
 *
 * Canonical id is "megaplay" so it matches ProviderModal and the rest of the
 * system. The file keeps its historical name.
 *
 * Resolution strategy (our anime ids are AniList ids):
 *   1. Primary  — https://megaplay.buzz/stream/ani/{anilistId}/{ep}/{lang}
 *   2. Fallback — https://megaplay.buzz/stream/mal/{malId}/{ep}/{lang}
 *      (malId is looked up from AniList, server-side, only when step 1 fails)
 *
 * The Anikoto /series/{id} endpoint is intentionally NOT used: it is keyed by
 * Anikoto's own catalogue id and there is no documented AniList -> Anikoto
 * mapping, so we cannot address it reliably from an AniList id.
 *
 * IMPORTANT: MegaPlay answers HTTP 200 even for embeds that do not exist,
 * returning an HTML error page ("Error - MegaPlay", "Error Code: 410/404").
 * It also blocks requests that arrive without a Referer. So every candidate is
 * probed server-side (with a Referer) and the HTML is inspected before it is
 * handed back as a source. If nothing resolves we return [] and the existing
 * "provider unavailable" UI is shown.
 */

const MEGAPLAY_BASE = "https://megaplay.buzz";
const ANILIST_API = "https://graphql.anilist.co";

const PROBE_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Cache a successful/failed probe for a while, but never indefinitely — a
// freshly added episode should become playable without a redeploy.
const PROBE_REVALIDATE_SECONDS = 60 * 30;
const MAL_LOOKUP_REVALIDATE_SECONDS = 60 * 60 * 24;

type MegaPlayEndpoint = "ani" | "mal";

function buildEmbedUrl(
    endpoint: MegaPlayEndpoint,
    id: string | number,
    episode: number,
    type: AudioType
): string {
    return (
        `${MEGAPLAY_BASE}/stream/${endpoint}/` +
        `${encodeURIComponent(String(id))}/` +
        `${episode}/` +
        `${type}`
    );
}

/**
 * A real MegaPlay embed page carries "File <id> - MegaPlay" in the <title> and a
 * data-id="<id>" attribute. The error page carries "Error - MegaPlay" and an
 * "Error Code:" block. Treat anything that is not clearly a player as invalid.
 */
function isPlayableEmbedHtml(html: string): boolean {
    if (/Error\s*-\s*MegaPlay/i.test(html)) {
        return false;
    }

    if (/Error Code:\s*<span>/i.test(html)) {
        return false;
    }

    return (
        /File\s+\d+\s*-\s*MegaPlay/i.test(html) ||
        /data-id="\d+"/i.test(html)
    );
}

async function embedResolves(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, {
            headers: {
                // MegaPlay returns a 410 error page when no Referer is present.
                // A browser <iframe> always sends one; mirror that here.
                Referer: `${MEGAPLAY_BASE}/`,
                "User-Agent": PROBE_USER_AGENT,
            },
            next: {
                revalidate: PROBE_REVALIDATE_SECONDS,
            },
        });

        if (!response.ok) {
            return false;
        }

        const html = await response.text();

        return isPlayableEmbedHtml(html);
    } catch (error) {
        console.error("MegaPlay probe failed:", url, error);
        return false;
    }
}

async function fetchMalId(
    anilistId: string
): Promise<number | null> {
    try {
        const response = await fetch(ANILIST_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query:
                    "query ($id: Int) { " +
                    "Media(id: $id, type: ANIME) { idMal } }",
                variables: {
                    id: Number(anilistId),
                },
            }),
            next: {
                revalidate: MAL_LOOKUP_REVALIDATE_SECONDS,
            },
        });

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        const idMal = result?.data?.Media?.idMal;

        return typeof idMal === "number" && idMal > 0
            ? idMal
            : null;
    } catch (error) {
        console.error(
            "MegaPlay MAL id lookup failed:",
            anilistId,
            error
        );
        return null;
    }
}

const megaplayProvider: Provider = {
    id: "megaplay",
    name: "MegaPlay",

    category: "megaplay",
    priority: 1,

    async getEpisodes(
        animeId,
        totalEpisodes
    ): Promise<EpisodeList> {
        const total =
            typeof totalEpisodes === "number" &&
            totalEpisodes > 0
                ? totalEpisodes
                : 0;

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
        const anilistId = animeId?.trim() ?? "";

        if (
            !/^\d+$/.test(anilistId) ||
            !Number.isInteger(episode) ||
            episode < 1
        ) {
            return [];
        }

        // 1. Primary: AniList id endpoint.
        const aniUrl = buildEmbedUrl(
            "ani",
            anilistId,
            episode,
            type
        );

        if (await embedResolves(aniUrl)) {
            return [
                {
                    provider: "megaplay",
                    type,
                    url: aniUrl,
                },
            ];
        }

        // 2. Fallback: MAL id endpoint (only if we can resolve a MAL id).
        const malId = await fetchMalId(anilistId);

        if (malId) {
            const malUrl = buildEmbedUrl(
                "mal",
                malId,
                episode,
                type
            );

            if (await embedResolves(malUrl)) {
                return [
                    {
                        provider: "megaplay",
                        type,
                        url: malUrl,
                    },
                ];
            }
        }

        // 3. Nothing resolved — let the UI show "provider unavailable".
        return [];
    },
};

export default megaplayProvider;
