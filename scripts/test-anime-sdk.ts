import {
  AllmangaProvider,
  AnikotoProvider,
  AnimeParadiseProvider,
  GogoanimeProvider,
  GoyabuProvider,
  FetchTransport,
  HttpClient,
  MegaPlayProvider,
  type BaseProvider,
  type IVideoPayload,
} from "anime-sdk";

const QUERY = "Naruto";
const EPISODE_NUMBER = 1;

type ProviderFactory = (http: HttpClient) => BaseProvider;

const providers: Array<{ name: string; create: ProviderFactory }> = [
  { name: "MegaPlay", create: (http) => new MegaPlayProvider(http) },
  { name: "Anikoto", create: (http) => new AnikotoProvider(http) },
  {
    name: "AnimeParadise",
    create: (http) => new AnimeParadiseProvider(http),
  },
  { name: "Allmanga", create: (http) => new AllmangaProvider(http) },
  { name: "Gogoanime", create: (http) => new GogoanimeProvider(http) },
  { name: "Goyabu", create: (http) => new GoyabuProvider(http) },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printJson(label: string, value: unknown): void {
  console.log(`${label}:`);
  console.log(JSON.stringify(value, null, 2));
}

function isDirectPlayableUrl(sourceUrl: string): boolean {
  try {
    const url = new URL(sourceUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function streamType(stream: IVideoPayload): string {
  if (stream.isHLS || /\.m3u8(?:$|[?#])/i.test(stream.sourceUrl)) {
    return "HLS";
  }
  if (/\.mp4(?:$|[?#])/i.test(stream.sourceUrl)) {
    return "MP4";
  }
  return "OTHER";
}

async function testProvider(
  name: string,
  createProvider: ProviderFactory,
): Promise<boolean> {
  const http = new HttpClient({
    timeoutMs: 25_000,
    transport: new FetchTransport(),
  });
  const provider = createProvider(http);
  let searchPassed = false;
  let episodesPassed = false;
  let resolved: Awaited<ReturnType<BaseProvider["resolveStream"]>> | undefined;

  console.log(`\n===== ${name} =====`);
  console.log(`PROVIDER: ${name}`);

  try {
    const results = await provider.search(QUERY);
    searchPassed = results.length > 0;
    printJson("SEARCH RESULTS", results);
    if (!searchPassed) throw new Error(`No search results for ${QUERY}`);

    const selected = results[0];
    console.log(`SELECTED ANIME/PROVIDER ID: ${selected.id}`);
    console.log(`SELECTED TITLE: ${selected.title}`);

    const units = await provider.fetchContentUnits(selected.id);
    const episode = units.find((unit) => unit.number === EPISODE_NUMBER);
    episodesPassed = Boolean(episode);
    printJson("EPISODE LIST", units);
    if (!episode) {
      throw new Error(
        `Episode ${EPISODE_NUMBER} not found (available: ${units.map((unit) => unit.number).join(", ")})`,
      );
    }

    console.log(`EPISODE 1 CONTENT UNIT ID: ${episode.id}`);
    console.log(
      `AVAILABLE LANGUAGES: ${episode.availableLanguages?.join(", ") || "unknown"}`,
    );

    resolved = await provider.resolveStream(episode.id, "sub");
    printJson("RESOLVE STREAM RESULT", resolved);

    if (resolved.type !== "video") {
      throw new Error(`resolveStream returned type ${resolved.type}, not video`);
    }

    for (const [index, stream] of resolved.streams.entries()) {
      console.log(`STREAM ${index + 1}:`);
      console.log(`  sourceUrl: ${stream.sourceUrl}`);
      console.log(`  isHLS: ${stream.isHLS}`);
      console.log(`  quality: ${stream.quality}`);
      console.log(`  language: ${stream.language || "unknown"}`);
      console.log(`  subtitles: ${JSON.stringify(stream.subtitles || [])}`);
      console.log(`  headers: ${JSON.stringify(stream.headers || {})}`);
    }

    const playable = resolved.streams.find((stream) =>
      isDirectPlayableUrl(stream.sourceUrl),
    );
    const hasRealStream = Boolean(playable);
    console.log(`SEARCH: ${searchPassed ? "PASS" : "FAIL"}`);
    console.log(`EPISODES: ${episodesPassed ? "PASS" : "FAIL"}`);
    console.log(`STREAM RESOLUTION: ${resolved.streams.length ? "PASS" : "FAIL"}`);
    console.log(`REAL STREAM URL: ${hasRealStream ? "YES" : "NO"}`);
    console.log(`STREAM TYPE: ${playable ? streamType(playable) : "N/A"}`);
    console.log(`QUALITY: ${playable?.quality || "N/A"}`);
    console.log(`ERROR: ${hasRealStream ? "None" : "No direct playable URL returned"}`);
    return hasRealStream;
  } catch (error) {
    const failure = errorMessage(error);
    console.log(`SEARCH: ${searchPassed ? "PASS" : "FAIL"}`);
    console.log(`EPISODES: ${episodesPassed ? "PASS" : "FAIL"}`);
    console.log(`STREAM RESOLUTION: ${resolved ? "PASS" : "FAIL"}`);
    console.log(`REAL STREAM URL: NO`);
    console.log(`STREAM TYPE: N/A`);
    console.log(`QUALITY: N/A`);
    console.log(`ERROR: ${failure}`);
    return false;
  }
}

async function main(): Promise<void> {
  for (const provider of providers) {
    const found = await testProvider(provider.name, provider.create);
    if (found) {
      console.log(`\nA real stream URL was returned by ${provider.name}; stopping.`);
      return;
    }
  }

  console.log("\nNo tested provider returned a direct playable stream URL.");
}

main().catch((error) => {
  console.error(`TEST SCRIPT ERROR: ${errorMessage(error)}`);
  process.exitCode = 1;
});
