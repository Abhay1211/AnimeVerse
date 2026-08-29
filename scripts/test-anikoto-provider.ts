import {
    AnikotoProvider,
    FetchTransport,
    HttpClient,
} from "anime-sdk";

type TestCase = { anime: string; id: string; episode: number; language: "sub" | "dub" };
type Series = { data?: { anime?: { title?: string }; episodes?: Array<{ number?: number | string; episode_embed_id?: string | number; embed_url?: Record<string, string> }> } };

const tests: TestCase[] = [
    { anime: "One Piece", id: "21", episode: 1, language: "sub" },
    { anime: "One Piece", id: "21", episode: 1, language: "dub" },
    { anime: "One Piece", id: "21", episode: 2, language: "sub" },
    { anime: "Case Closed", id: "235", episode: 1, language: "sub" },
    { anime: "Demon Slayer", id: "101922", episode: 1, language: "sub" },
    { anime: "Demon Slayer", id: "101922", episode: 1, language: "dub" },
    { anime: "Naruto", id: "20", episode: 1, language: "sub" },
    { anime: "Bleach", id: "269", episode: 1, language: "sub" },
    { anime: "Attack on Titan", id: "16498", episode: 1, language: "sub" },
    { anime: "Jujutsu Kaisen", id: "145064", episode: 1, language: "sub" },
    { anime: "My Hero Academia", id: "21459", episode: 1, language: "sub" },
];

const sdk = new AnikotoProvider(new HttpClient({ timeoutMs: 25_000, transport: new FetchTransport() }));
const appUrl = process.env.ANIMEVERSE_URL ?? "http://localhost:3000";

async function main(): Promise<void> {
    const { resolveAnikotoSeriesId } = await import("../app/lib/providers/anikoto-sdk" + ".ts");
    for (const test of tests) {
        let seriesId: string | null = null;
        let episodeFound = false;
        let embedFound = false;
        let streamResolved = false;
        let hlsValid = false;
        let subtitles = 0;
        let animeVerseSource = false;
        let error = "";

        try {
            seriesId = await resolveAnikotoSeriesId(test.id, test.episode);
            if (!seriesId) throw new Error("AniList to Anikoto mapping not found");
            const units = await sdk.fetchContentUnits(`anikoto:${seriesId}`);
            const unit = units.find((candidate) => candidate.number === test.episode);
            episodeFound = Boolean(unit);
            if (!unit) throw new Error("Requested episode not found");

            const seriesResponse = await fetch(`https://anikotoapi.site/series/${encodeURIComponent(seriesId)}`);
            const series = (await seriesResponse.json()) as Series;
            const episode = series.data?.episodes?.find((candidate) => Number(candidate.number) === test.episode);
            embedFound = Boolean(episode?.embed_url?.[test.language]);

            const result = await sdk.resolveStream(unit.id, test.language);
            if (result.type !== "video" || result.streams.length === 0) throw new Error("No video stream returned");
            streamResolved = true;
            const stream = result.streams[0];
            subtitles = stream.subtitles?.length ?? 0;
            const response = await fetch(stream.sourceUrl, { headers: stream.headers, signal: AbortSignal.timeout(25_000) });
            const body = await response.text();
            hlsValid = response.ok && stream.isHLS && body.trimStart().startsWith("#EXTM3U");
            if (!hlsValid) throw new Error(`HLS validation failed (HTTP ${response.status})`);

            try {
                const appResponse = await fetch(`${appUrl}/api/anime/watch?id=${test.id}&episode=${test.episode}&type=${test.language}&provider=anikoto`);
                const appPayload = (await appResponse.json()) as { sources?: Array<{ isHLS?: boolean }> };
                animeVerseSource = appResponse.ok === true && Boolean(appPayload.sources?.[0]?.isHLS);
                if (!animeVerseSource) throw new Error("Anime Verse endpoint did not return an HLS source");
            } catch (caught) {
                if (!error) error = caught instanceof Error ? `Anime Verse endpoint: ${caught.message}` : `Anime Verse endpoint: ${String(caught)}`;
            }
        } catch (caught) {
            error = caught instanceof Error ? caught.message : String(caught);
        }

        console.log(JSON.stringify({
            anime: test.anime,
            anilistId: test.id,
            seriesId,
            episode: test.episode,
            language: test.language,
            episodeFound,
            embedFound,
            streamResolved,
            hlsValid,
            subtitles,
            animeVerseSource,
            error: error || "None",
        }));
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
