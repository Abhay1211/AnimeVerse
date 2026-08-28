# Anime Verse — Data Flow & Architecture Report

> Reflects the codebase **after** the AniList-card / rating / season / actions
> fixes. Written so another developer can understand the app without
> reverse-engineering it. Last updated with the "rating /10 + AniList cards +
> franchise seasons" change set.

---

## 1. Project overview

Anime Verse (internal codename **Z‑ANIME**) is a Next.js 16 (App Router) /
React 19 / TypeScript anime browsing + streaming front‑end.

- **Metadata** comes from **AniList** (GraphQL).
- **Cinematic artwork** (wide backdrop + stylised text logo) for the home hero
  and the detail‑page background comes from **TMDB**.
- **Per‑episode still frames / titles** on the watch page come from **TMDB**.
- **Playable video embeds** come from **MegaPlay / Anikoto** (`megaplay.buzz`).
- There is **no backend / database / auth**. "Favorites" and "Plan to Watch"
  are `localStorage` only.

All external calls go through **internal Next.js API routes** (`app/api/anime/*`)
so the browser never talks to AniList/TMDB directly and API tokens stay server
side.

---

## 2. Folder structure

```
app/
├─ layout.tsx                 Root layout (fonts, globals.css)
├─ page.tsx                   Landing page ("/")  — marketing, video hero
├─ globals.css                ~7.7k lines, ALL component styling lives here
├─ AnimeVerseLogo.tsx         SVG logo used on "/"
│
├─ anime/
│  ├─ layout.tsx              pass-through
│  ├─ page.tsx                "/anime"  — main home (hero + rows)
│  └─ [id]/
│     ├─ page.tsx             "/anime/[id]"  — anime detail page
│     └─ watch/page.tsx       "/anime/[id]/watch"  — player
│
├─ browse/page.tsx            "/browse"  — discovery grid of sections
├─ explore/page.tsx           "/explore" — "what do you want to explore" picker
├─ genre/[genre]/page.tsx     "/genre/[genre]" — genre results + multi-filter
├─ search/page.tsx            "/search" — search + "Ask AI" (AI is placeholder)
│
├─ api/anime/
│  ├─ home/route.ts           GET  home payload (7 sections + hero)
│  ├─ browse/route.ts         GET  filtered list + accurate genre count probe
│  ├─ trending/route.ts       GET  (UNUSED — dead route)
│  ├─ [id]/route.ts           GET  one anime + TMDB art + franchise season count
│  ├─ [id]/episodes/route.ts  GET  TMDB per-episode stills for watch page
│  └─ watch/route.ts          GET  resolve playable sources from a provider
│
├─ components/                see §6
├─ data/
│  ├─ anime.ts                Anime type + mapAniListAnime + buildWatchStructure
│  │                          + display helpers (formatScore, formatEpisodeMeta,
│  │                          countFranchiseSeasons)
│  └─ genres.ts               canonical AniList genre list (18) + resolveGenre()
└─ lib/
   ├─ tmdb.ts                 TMDB search + artwork + episode-stills helpers
   └─ providers/
      ├─ index.ts             provider registry (currently 1: megaplay)
      ├─ types.ts             Provider / VideoSource / EpisodeList types
      └─ anikoto.ts           MegaPlay ("Anikoto") provider implementation
```

---

## 3. Frontend architecture

- **Next.js App Router**, every page that fetches data is a **Client Component**
  (`"use client"`). Pages fetch on mount via `useEffect` → internal API route.
- No global store. State is local `useState` per page + **two module-scope
  caches**:
  - `useHomeAnime.ts` — memoises the `/api/anime/home` response so `/anime` and
    `/browse` share one request.
  - `useAnimeSearch.ts` — in-flight de-dupe map for `/api/anime/browse?search=`.
- **Styling**: a single `app/globals.css`. Components use semantic class names
  (`.anime-card`, `.anime-detail-*`, `.row-scroller`, …). A few watch-page
  helpers use Tailwind utility strings (`watchUi.ts`). No CSS modules.
- **Fonts**: `JetBrains Mono` / `Michroma` / `Manrope` via `next/font` (in
  `layout.tsx`).

---

## 4. Routing

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing (video background). Not part of the anime app. |
| `/anime` | `app/anime/page.tsx` | Home: hero carousel + Latest Episodes + 5 `AnimeRow`s + Top 10 |
| `/anime/[id]` | `app/anime/[id]/page.tsx` | Anime detail |
| `/anime/[id]/watch` | `app/anime/[id]/watch/page.tsx` | Player (`?episode=&type=sub|dub&provider=`) |
| `/browse` | `app/browse/page.tsx` | Same `home` payload, rendered as 6 sections |
| `/genre/[genre]` | `app/genre/[genre]/page.tsx` | Genre results (`?genres=a,b,c` multi, `?page=`) |
| `/search` | `app/search/page.tsx` | Search (Ask‑AI tab is a placeholder) |
| `/explore` | `app/explore/page.tsx` | Static destination picker |

`AnimeNavbar` (floating bottom bar) is rendered on `/anime`, `/browse`,
`/genre/[genre]`, `/search`, `/anime/[id]`, `/anime/[id]/watch`. Its "Explore"
item → `/explore`; back/forward use `window.history`.

Genre navigation everywhere uses **`/genre/${encodeURIComponent(name)}`** with
canonical casing (`/genre/Action`, `/genre/Slice%20of%20Life`). `resolveGenre()`
matches case‑insensitively so old lowercase links still work.

---

## 5. Main pages

### `/anime` (`app/anime/page.tsx`)
```
useHomeAnime() ──▶ GET /api/anime/home  (module-cached)
   ├─ heroAnime      → <AnimeHero>            (TMDB backdrop + logo)
   ├─ latestEpisodes → <LatestEpisodes>       (wide episode cards, expandable)
   ├─ topAiring      → <AnimeRow "TOP AIRING">
   ├─ mostPopular    → <AnimeRow "MOST POPULAR">
   ├─ mostFavorite   → <AnimeRow "MOST FAVORITE">
   ├─ recentlyAdded  → <AnimeRow "RECENTLY ADDED">
   ├─ topUpcoming    → <AnimeRow "TOP UPCOMING">
   └─ topAiring/mostPopular/mostFavorite → <TopTen>
```

### `/browse` (`app/browse/page.tsx`)
Same `useHomeAnime()` payload, rendered as:
`LATEST EPISODES` (poster cards, **not** expandable) · `TOP AIRING` ·
`MOST POPULAR` · `LATEST COMPLETED` · `RECENTLY ADDED` · `TOP UPCOMING`.

### `/anime/[id]` (`app/anime/[id]/page.tsx`)
```
GET /api/anime/{id}  ──▶  Anime (+ TMDB banner/logo, + totalSeasons)
   ├─ hero: banner bg, year/type badges, title, genre <Link>s, Watch Now / Plan to Watch
   ├─ poster card (desktop): AniList cover, favourite ♥ toggle, "SEASONS n" overlay
   ├─ Details: Share button, genre chips (<Link>), synopsis, "More Like This"
   ├─ Related Media grid (relatedMedia, 1-hop)
   └─ Stats grid: Format, Episodes, Seasons, Duration, Score, Status, Studio,
      Season, Popularity, MAL ID, Aired, Next Episode (+ live countdown)
```

### `/genre/[genre]` (`app/genre/[genre]/page.tsx`)
```
GET /api/anime/browse?genre=X&perPage=24&page=N        → results grid/list
GET /api/anime/browse?countOnly=1&genre=X              → accurate total ("1,000+")
```
`GenreFilter` (multi-select popover) → `router.push` with `?genres=`. Clearing
the last genre → `router.push("/anime")`.

### `/search` (`app/search/page.tsx`)
`useAnimeSearch(query)` → `GET /api/anime/browse?search=…&perPage=30`. Renders
`AnimeCard` grid. "Ask AI" tab is UI‑only (no AI backend).

### `/anime/[id]/watch` (`app/anime/[id]/watch/page.tsx`)
See §18.

---

## 6. Main components

| Component | Role | Data source |
|---|---|---|
| `AnimeHero` | Home hero drag carousel | `heroAnime` (AniList meta + **TMDB** poster/banner/logo) |
| `AnimeRow` | Horizontal card row + circular nav | `Anime[]` from `home` |
| `AnimeCard` | The anime card (grid + `layout="list"`) | props: title, image (AniList cover), score, episodes, format |
| `LatestEpisodes` | "/// LATEST EPISODES" section, collapse/expand | `LatestEpisode[]` |
| `LatestEpisodeCard` | Wide episode tile (home only) | `LatestEpisode` |
| `TopTen` | "TOP 10" ranked cards (day/week/month tabs) | `topAiring / mostPopular / mostFavorite` reused |
| `AnimeSearch` | Home inline search bar + dropdown | `useAnimeSearch` |
| `AnimeCategories` | Genre chip strip on `/anime` | `data/genres.ts` (static) |
| `GenreFilter` | Multi-select genre popover | `data/genres.ts` |
| `AnimeNavbar` | Floating bottom nav | static |
| `ProviderModal` | Provider picker before "Watch" | `lib/providers` list |
| `EpisodeRail` / `VideoPlayer` / `PlaybackSurface` | Watch page | `watch` route + `episodes` route |
| `FeaturedCarousel` | **Unused** legacy component | — |

---

## 7. State management

- **No** Redux / Zustand / Context for data.
- Module-scope caches: `useHomeAnime` (`cached`, `inFlight`), `useAnimeSearch`
  (`inFlight` map).
- **Favourite / Plan to Watch**: `localStorage` keys
  `animeverse:favorites` and `animeverse:plan-to-watch` — a JSON array of anime
  ids. Toggled in `app/anime/[id]/page.tsx` via `toggleStoredId()`, restored on
  mount. A tiny `.anime-detail-toast` element gives feedback.
- **Watch page** keeps player/episode/provider state in local `useState` and
  reads `episode/type/provider` from the URL query.

---

## 8. API architecture

All server routes live under `app/api/anime/`. Pattern for every route:

```
Client fetch  →  Next route handler  →  AniList GraphQL (and/or TMDB / MegaPlay)
              ←  NextResponse.json(normalised shape)  ←  mapAniListAnime()
```

`mapAniListAnime(aniListMedia)` in `app/data/anime.ts` is the **single
normalisation point** — every list/detail route pipes AniList media through it
to produce the `Anime` shape the whole UI consumes.

Caching is done with Next's `fetch(..., { next: { revalidate } })`:

| Route | AniList cache | TMDB cache |
|---|---|---|
| `home` | `revalidate: 3600` | in-process `Map` (`lib/tmdb.ts`), per title/year |
| `[id]` | `revalidate: 3600` | same map |
| `[id]` chain walk | `revalidate: 86400` | — |
| `[id]/episodes` | — | `revalidate: 86400 / 604800` + `Cache-Control` header |
| `browse` | `cache: "no-store"` (results) / `revalidate: 3600` (count probe) | — |
| `watch` | MegaPlay probe `revalidate: 1800`, MAL lookup `86400` | — |

---

## 9. External APIs / providers

### AniList — `https://graphql.anilist.co`  **(REQUIRED, primary)**
- **Why**: all anime metadata — titles, cover, score, episodes, format, genres,
  status, air dates, duration, studios, popularity, MAL id, relations,
  next‑airing episode, `streamingEpisodes` titles/thumbnails, airing schedule.
- **Used by**: every `app/api/anime/*` route, plus `lib/providers/anikoto.ts`
  (AniList → MAL id lookup for the MegaPlay `mal` fallback).
- **Overlap**: none for metadata.

### TMDB — `https://api.themoviedb.org/3`  **(REQUIRED, artwork only)**
- **Why**: AniList has **no wide cinematic backdrop** and **no stylised text
  logo**, and its `bannerImage` is frequently `null` or a thin strip. TMDB
  provides both, plus real per‑episode still frames + episode titles for the
  watch page.
- **Auth**: `process.env.TMDB_API_TOKEN` (bearer).
- **Used by (after the fix)**:
  1. `api/anime/home` → `heroAnime` only (top‑5 airing) — backdrop + logo.
  2. `api/anime/[id]` → detail‑page **banner** + (unused) logo. **Poster is NOT
     overridden anymore — it stays AniList `coverImage.large`.**
  3. `api/anime/[id]/episodes` → per‑episode stills/titles for the watch page.
- **Overlap**: partial with AniList (`coverImage`, `bannerImage`,
  `streamingEpisodes`). AniList "wins" for the poster and for episode metadata
  when present; TMDB fills the gaps AniList cannot.
- **Still needed?** **Yes** — for the hero backdrop+logo and the watch‑page
  episode stills. It is **no longer used for any anime card** and no longer for
  the detail poster. Removing it entirely would leave the hero without its logo
  and the watch page without episode thumbnails/titles for shows AniList doesn't
  list `streamingEpisodes` for.

### MegaPlay / Anikoto — `https://megaplay.buzz`  **(REQUIRED, streaming)**
- **Why**: the only source of playable `<iframe>` embeds.
- **Endpoints probed** (`lib/providers/anikoto.ts`):
  - `…/stream/ani/{anilistId}/{ep}/{lang}` (primary — our ids are AniList ids)
  - `…/stream/mal/{malId}/{ep}/{lang}` (fallback — MAL id looked up from AniList)
- MegaPlay returns HTTP 200 even for missing embeds, so every candidate URL is
  fetched server‑side **with a `Referer`** and the HTML is inspected
  (`File N - MegaPlay` = ok, `Error - MegaPlay` = reject).
- The Anikoto `/series/{id}` catalogue endpoint is **deliberately not used** —
  there is no AniList→Anikoto id mapping.
- **Used by**: `api/anime/watch` only.

### Jikan / MyAnimeList API — **NOT used directly.**
The only MAL touch‑point is *AniList's* `idMal` field, used to build the MegaPlay
`mal` fallback URL. No `api.jikan.moe` calls anywhere.

### Redundant / dead
- **`app/api/anime/trending/route.ts`** — a fully working AniList list endpoint
  that **nothing imports**. Safe to delete; left in place (out of scope).
- **`app/components/FeaturedCarousel.tsx`** — legacy, unused.

---

## 10. Internal API routes (contract)

### `GET /api/anime/home`
```jsonc
{
  "heroAnime":     Anime[5],   // AniList meta + TMDB poster/banner/logo (hero ONLY)
  "latestEpisodes": (Anime & { latestEpisode, airingAt, episodeThumbnail, providerCount })[24],
  "topAiring":     Anime[20],  // 100% AniList
  "mostPopular":   Anime[20],
  "mostFavorite":  Anime[20],
  "latestCompleted": Anime[20],
  "recentlyAdded": Anime[20],
  "topUpcoming":   Anime[20]
}
```
One AniList GraphQL request (7 aliased `Page` blocks + 1 `airingSchedules`) +
5 TMDB `getTmdbArtwork` calls (hero only, `Promise.all`, cached). Dead
`addTmdbArtwork()` and a crash‑prone `console.log` were removed.

### `GET /api/anime/browse`
- `?search=` / `?genre=` (repeatable) / `?format=` / `?status=` / `?season=` /
  `?seasonYear=` / `?page=` / `?perPage=` → `{ anime: Anime[], pagination }`.
- `?countOnly=1` → skips the results query, runs `probeTotal()` (a **single
  aliased 20×50 query**) → `{ pagination: { total, totalIsCapped } }`.
  Used by the genre page for a real per‑genre count (see §30/§31).

### `GET /api/anime/[id]`
One AniList `Media` query → `mapAniListAnime` → then:
1. `getTmdbArtwork(title, year)` → overrides `banner` (+ `logo`). **Poster stays
   AniList.**
2. `walkFranchiseChain(id)` → BFS over `PREQUEL`/`SEQUEL` TV/TV_SHORT relations
   (batched `id_in`, ≤6 batches, ≤14 nodes, `revalidate: 86400`) →
   `countFranchiseSeasons(chain)` → `anime.totalSeasons`.

### `GET /api/anime/[id]/episodes?title=&year=`
`getTmdbEpisodeImages()` → `{ episodes: [{ number, title, thumbnail }] }`
(absolute episode order; handles multi‑season TMDB shows via "Absolute" episode
groups). Watch page only.

### `GET /api/anime/watch?id=&episode=&type=&provider=`
Picks a provider from `lib/providers`, calls `provider.getSources(id, ep, lang)`
→ `{ animeId, episode, type, selectedProvider, providers[], sources: VideoSource[] }`.

---

## 11. Homepage data flow (detailed)

```
/anime page mount
  └─ useHomeAnime()
       └─ (module cache miss) fetch("/api/anime/home")
            └─ route:  fetch(graphql.anilist.co, { revalidate: 3600 })
                 query = 7 aliased Page{ media{…} } + latestEpisodes: Page{ airingSchedules{ episode media{…} } }
            └─ per section: media.map(mapAniListAnime)
            └─ latestEpisodes: dedupe airingSchedules by media id, keep newest,
                 attach { latestEpisode, airingAt, episodeThumbnail, providerCount }
            └─ heroAnime: topAiring.slice(0,5).map(a => ({...a, ...TMDB artwork}))
            └─ JSON { heroAnime, latestEpisodes, topAiring, … }
       └─ cached at module scope; returned to every subscriber
  └─ render:
       <AnimeHero anime={heroAnime}>            // background = TMDB banner, logo = TMDB
       <LatestEpisodes episodes={latestEpisodes}>
       <AnimeRow anime={topAiring}>  → AnimeCard × 20  (image = AniList coverImage.large)
       … 4 more rows …
       <TopTen day={topAiring} week={mostPopular} month={mostFavorite}>
```

`/browse` is identical minus the hero, plus a `LATEST COMPLETED` row, and its
`<LatestEpisodes cardStyle="poster" expandable={false}>`.

---

## 12. Anime detail page data flow (detailed)

```
/anime/[id] mount
  └─ fetch(`/api/anime/${id}`)
       └─ AniList Media(id) query  →  mapAniListAnime  →  Anime
       └─ TMDB getTmdbArtwork(title, year)  →  banner (+ logo)
       └─ walkFranchiseChain(id):
            frontier=[id]
            repeat ≤6×:  Page{ media(id_in: frontier){ id format seasonYear title relations{edges{relationType node{id format}}} } }
                         push unseen PREQUEL/SEQUEL nodes whose format ∈ {TV,TV_SHORT}
            → TV entries sorted by seasonYear
       └─ countFranchiseSeasons(chain)  →  anime.totalSeasons
  └─ render (see §5). Client also computes a 1-hop fallback via
     buildWatchStructure(anime).seasons.length if totalSeasons is missing.
  └─ actions:
       Watch Now      → setShowProviderModal(true) → ProviderModal.onStart →
                        router.push(`/anime/${id}/watch?episode=1&type=sub&provider=${sel}`)
       Plan to Watch  → toggleStoredId("animeverse:plan-to-watch", id) + toast
       ♥ favourite    → toggleStoredId("animeverse:favorites", id) + toast
       Share          → navigator.share({title,text,url}) → catch → clipboard.writeText(url) + toast
       genre chip     → <Link href={`/genre/${encodeURIComponent(genre)}`}>
```

---

## 13. Anime cards  (**after the fix — 100% AniList**)

`AnimeCard` props are all AniList‑sourced (via `mapAniListAnime`):

| Prop | AniList field | Notes |
|---|---|---|
| `title` | `title.english ?? title.romaji ?? title.native` | |
| `image` | `coverImage.large` | **was TMDB for the hero‑5; now always AniList** |
| `score` | `averageScore` (0–100) | rendered `formatScore(score)` → `"8.7"` |
| `episodes` | `episodes ?? (nextAiringEpisode.episode - 1)` | real count, uncapped |
| `format` | `format ?? "TV"` | |

Badges:
- **Rating** — `★ 8.7` via `formatScore()` (`averageScore / 10`, 1 dp). Hidden
  when `averageScore` is null.
- **Format / episodes** — `formatEpisodeMeta(format, episodes)`:
  - `TV` + 14 → `"TV · 14 EP"`
  - `MOVIE` + 1 → `"MOVIE"`  (movies never show an episode count)
  - `TV` + null → `"TV"`
  - `OVA` + 4 → `"OVA · 4 EP"`
  - One Piece → `"TV · 1175 EP"` (from `nextAiringEpisode.episode - 1`)
  - CSS: `.anime-card-format` is `white-space: nowrap; text-overflow: ellipsis;
    max-width: calc(100% - 20px)` so 1000+ counts never overflow/overlap.

`layout="list"` (genre list view): `TV` badge + `SUB 14` (skipped for MOVIE),
no WATCH button.

---

## 14. Search

`/search` and the home `AnimeSearch` both use `useAnimeSearch(query)` →
`GET /api/anime/browse?search=${q}&perPage=N`. AniList `Media(search:)` sorted by
`POPULARITY_DESC`. Results render as `AnimeCard`s. The `pagination.total` shown
on `/search` ("N RESULTS FOUND") is AniList's **capped** `pageInfo.total` — see
§31; it is a rough figure, never used as an episode/season count.

---

## 15. Genre filtering

- Canonical genre list: `app/data/genres.ts` — **18 AniList genres** (Action …
  Thriller). This is AniList's real genre vocabulary; it is *not* MAL's 41.
- `/genre/[genre]` reads the path + `?genres=a,b,c` → `selectedGenres`.
- Results: `GET /api/anime/browse?genre=…&genre=…&perPage=24&page=N`
  (AniList `genre_in`).
- Count: `GET /api/anime/browse?countOnly=1&genre=…` → `probeTotal()` walks up to
  20 pages × 50 and sums real results; if it fills all 20 it returns
  `total: 1000, totalIsCapped: true` → UI shows `"1,000+"`. **AniList's
  `pageInfo.total` is never trusted here** (it returns 5000 for every genre).
- `GenreFilter` stages a working set, `Apply` pushes the new URL, `Clear` empties
  it; removing the last chip → `/anime`.

---

## 16. Episode data

Two independent notions:

1. **Total episode count** (card + detail "Episodes" stat) —
   `Anime.episodes` = AniList `Media.episodes`, or `nextAiringEpisode.episode-1`
   when AniList reports `null` for an airing show. Movies show `—` on the detail
   stat and just `MOVIE` on the card.
2. **Per‑episode list** (watch page) — merged from:
   - AniList `Media.streamingEpisodes` (`mapAniListAnime` → `streamingEpisodes:
     { number, title, thumbnail }[]`, parsed from "Episode N - Title").
   - TMDB stills/titles via `GET /api/anime/[id]/episodes` (preferred for the
     thumbnail — a consistent real frame per episode).
   - `buildWatchStructure(anime).episodeCount` = `max(episodes, aired, 0)` for
     the count of the season being watched.

---

## 17. Streaming / server / provider flow

```
lib/providers/index.ts   providers = [ megaplayProvider ]   (id "megaplay")
      │
ProviderModal            lists providers, user picks one (default = primary)
      │
GET /api/anime/watch?id=<anilistId>&episode=<n>&type=sub|dub&provider=megaplay
      │
provider.getSources(anilistId, ep, lang)   (anikoto.ts)
      │  1. probe  megaplay.buzz/stream/ani/<anilistId>/<ep>/<lang>   (with Referer)
      │  2. if that HTML is an error page → look up idMal from AniList (cached 24h)
      │     probe  megaplay.buzz/stream/mal/<idMal>/<ep>/<lang>
      │  3. inspect HTML: "File N - MegaPlay" ⇒ VideoSource, "Error - MegaPlay" ⇒ drop
      ▼
{ sources: VideoSource[] }   → VideoPlayer renders the <iframe> embed
                             → [] ⇒ "provider unavailable" UI
```

---

## 18. Watch page flow (`/anime/[id]/watch`)

```
URL: /anime/<id>/watch?episode=<n>&type=<sub|dub>&provider=<pid>
  ├─ fetch(`/api/anime/${id}`)           → anime meta (relations, streamingEpisodes)
  ├─ buildWatchStructure(anime)          → seasons[], movies[], episodeCount, currentSeasonNumber
  ├─ fetch(`/api/anime/${id}/episodes`)  → TMDB stills/titles (only when the entry
  │                                         maps cleanly to TMDB absolute order)
  ├─ fetch(`/api/anime/watch?…`)         → sources[] + providers[]
  ├─ EpisodeRail   → episode list (title = AniList streamingEpisode ?? TMDB,
  │                   thumbnail = TMDB still ?? AniList thumb ?? banner)
  ├─ season pills  → <Link href={`/anime/${season.id}`}>   (adjacent AniList entries only)
  └─ VideoPlayer   → <iframe src={source.url}>
```

`buildWatchStructure` builds the local (1‑hop) season neighbourhood for the
switcher — this is *fine* for the switcher (you can only navigate to entries
AniList exposes). The **total** season count on the detail page uses the deeper
`walkFranchiseChain` instead.

---

## 19. User / watchlist functionality

`localStorage` only, no server:

| Feature | Key | Where |
|---|---|---|
| Favourites (♥ on the detail poster) | `animeverse:favorites` | `app/anime/[id]/page.tsx` |
| Plan to Watch (detail button) | `animeverse:plan-to-watch` | `app/anime/[id]/page.tsx` |

`toggleStoredId(key, id)` / `readStoredId(key, id)` operate on a JSON string
array. There is currently **no page that lists** favourites/planned items — the
navbar "Saved"/"Alerts"/"Profile" items are disabled placeholders.

---

## 20. Share functionality

`app/anime/[id]/page.tsx` → `shareAnime()`:
1. If `navigator.share` exists → `navigator.share({ title, text, url:
   window.location.href })`. User‑cancel falls through to (2).
2. Else → `navigator.clipboard.writeText(window.location.href)` + toast
   "Link copied to clipboard".

The shared URL is always the current `/anime/[id]` detail URL. No dependency
added.

---

## 21. Image sources

| Image | Source | Where |
|---|---|---|
| Anime **card** poster | AniList `coverImage.large` | every `AnimeCard`, `TopTen`, recommendations, related media |
| **Hero** poster (the fanned carousel cards) | **TMDB** poster (`heroAnime`) | `AnimeHero` |
| **Hero** background | **TMDB** backdrop (`heroAnime[i].banner`) | `AnimeHero` |
| **Hero** text logo | **TMDB** logo (falls back to TheTVDB inside `lib/tmdb.ts`) | `AnimeHero` |
| **Detail** page background | **TMDB** backdrop (`anime.banner`) | `/anime/[id]` hero |
| **Detail** poster card | **AniList** `coverImage.large` *(changed — was TMDB)* | `/anime/[id]` |
| Watch page **episode stills** | **TMDB** stills (`…/episodes`) ?? AniList `streamingEpisodes.thumbnail` ?? banner | `EpisodeRail` |
| Latest‑episode card background | AniList `streamingEpisodes.thumbnail` ?? `banner` ?? `poster` | `LatestEpisodeCard` |

---

## 22. Rating source

**AniList `Media.averageScore`** (a 0–100 integer).
→ `mapAniListAnime` copies it verbatim to `Anime.score` (no scaling stored).
→ Displayed via **`formatScore(score)` = `(score / 10).toFixed(1)`** →
`84 → "8.4"`, `90 → "9.0"`, `null → hidden`.

Used consistently by:
- `AnimeCard` — `★ 8.7` badge (grid + list)
- `LatestEpisodeCard` — `★ 8.7` pill
- `/anime/[id]` — Stats grid "Score" = `8.7` (was `87%`)

`AniList` also has `meanScore`; the project uses `averageScore` (weighted mean).

---

## 23. Episode‑count source

**AniList `Media.episodes`**, with a fallback:
```
Anime.episodes = Media.episodes
              ?? (Media.nextAiringEpisode ? nextAiringEpisode.episode - 1 : null)
```
- Normal finished show → the canonical total (e.g. `24`).
- Airing long‑runner where AniList gives `null` (One Piece, Detective Conan, …)
  → episodes aired so far (`1175`), a **real, uncapped** number.
- Truly unknown (announced, not airing) → `null` → card shows just the format,
  detail stat shows "Unknown".
- **Movies** → card shows `MOVIE` only; detail "Episodes"/"Seasons" show `—`.

`nextAiringEpisode { episode }` was added to the `home` and `trending` GraphQL
queries (`browse` and `[id]` already had it) so the fallback works everywhere.

**Never** derived from `pagination.total` or any page size.

---

## 24. Season‑count source

**A walked AniList prequel/sequel chain**, computed server‑side in
`api/anime/[id]/route.ts`:

```
walkFranchiseChain(rootId):
   BFS over relations edges where relationType ∈ {PREQUEL, SEQUEL}
                              and node.format ∈ {TV, TV_SHORT}
   batched with Page{ media(id_in: [...]) }, ≤6 batches, ≤14 nodes, cached 24h
   → list of TV entries, sorted by seasonYear

countFranchiseSeasons(chain):   (app/data/anime.ts)
   • entries with an explicit "Season N" / "Nth Season" → group by N
     ("Season 2" and "Season 2 Part 2" count once)
   • unnumbered entries cluster with their adjacent split parts
     ("The Final Season" + "… Part 2" + "… Part 3" count once)
   • result = distinct numbered seasons + unnumbered clusters, min 1
```

Verified: **One Piece → 1**, **Mushoku Tensei → 3**, **Re:ZERO → 4** (AniList
already lists Season 4 as a 2026 entry). No hardcoding, no "relation count =
seasons", no `pagination.total`, manga/novel/OVA/spin‑off relations excluded.

Client fallback (`buildWatchStructure(anime).seasons.length`, 1‑hop) is used only
if the API omits `totalSeasons` (e.g. the chain walk threw).

---

## 25. Related‑media source

**AniList `Media.relations.edges`** (1 hop) → `mapAniListAnime` →
`Anime.relatedMedia: { id, title, nativeTitle, poster, type, duration, episodes,
seasonYear, relationType }[]`. Rendered in the "Related Media" grid (first 6) and
"More Like This" uses `Media.recommendations`.

---

## 26. Popularity source

**AniList `Media.popularity`** → `Anime.popularity` → detail Stats grid
("Popularity", `toLocaleString()`). Also the implicit sort key for
`topAiring` / `mostPopular` / search / browse (`sort: POPULARITY_DESC`).
`mostFavorite` uses `sort: FAVOURITES_DESC`.

---

## 27. Studio / source metadata

- **Studios** — AniList `Media.studios.nodes[].name` → `Anime.studios: string[]`
  → detail Stats "Studio" (joined with ", ").
- **MAL ID** — AniList `Media.idMal` → `Anime.idMal` → detail Stats "MAL ID";
  also the MegaPlay `mal` fallback.
- **Air dates** — AniList `startDate` / `endDate` → detail Stats "Aired".
- **Duration** — AniList `Media.duration` (minutes) → detail Stats "Duration".
- **Status** — AniList `Media.status` (RELEASING/FINISHED/…) → detail Stats.
- **Season / seasonYear** — AniList `Media.season` / `seasonYear` → detail Stats
  "Season" (e.g. "SUMMER 2026").

---

## 28. Transformation / normalisation logic

`app/data/anime.ts`:

| Function | Purpose |
|---|---|
| `mapAniListAnime(media)` | AniList `Media` → `Anime` (the one shape the UI uses). Also applies the episode fallback and picks the best title. |
| `buildWatchStructure(anime)` | 1‑hop TV season neighbourhood + franchise movies + `episodeCount` for the watch page. |
| `parseStreamingEpisode(entry)` | `"Episode 12 - Title"` → `{ number, title, thumbnail }`. |
| `seasonNumberFromTitle(title)` | Extracts `Season N` / `Nth Season` / roman numerals. |
| `formatScore(score)` | 0–100 → `"8.4"` / `null`. |
| `formatEpisodeMeta(format, episodes)` | Card badge text (`"TV · 14 EP"` / `"MOVIE"` / `"TV"`). |
| `stripSeasonSplitMarkers(title)` | Removes "Part N" / "Cour N" for season grouping. |
| `countFranchiseSeasons(chain)` | Distinct‑season count from a walked chain. |

`app/data/genres.ts`: `GENRES` (18) + `resolveGenre(slug)` (case‑insensitive).

---

## 29. Caching

- **AniList** — `next: { revalidate: 3600 }` on `home` / `[id]`; `86400` on the
  season‑chain walk; `no-store` on `browse` results (so filters are live).
- **TMDB** — `lib/tmdb.ts` keeps an in‑process `Map<string, Promise>` per
  `title|year` for artwork and per `title|year` for episode images, plus
  `next: { revalidate }` on the underlying `fetch`.
- **Client** — `useHomeAnime` module cache (one `/api/anime/home` per page
  load / navigation); `useAnimeSearch` in‑flight de‑dupe.
- **MegaPlay** — probe results cached `1800s`, MAL lookups `86400s`.

---

## 30. Pagination

- `browse` accepts `page` / `perPage` (`perPage` clamped 1–50). Returns
  `pagination: { currentPage, lastPage, hasNextPage, total }` straight from
  AniList `pageInfo`.
- The **genre page ignores `pagination.total`** for its count and uses the
  `countOnly=1` probe instead (§15/§31). It shows `PAGE {n}` and drives
  next/prev from `hasNextPage`.
- Search shows AniList's `pageInfo.total` as an approximate "N RESULTS FOUND".

---

## 31. API limitations

| Limitation | Impact | Handling |
|---|---|---|
| **AniList `pageInfo.total` is capped at 5000 and ignores `genre_in`** | Can't show a true per‑genre count | `countOnly=1` probe sums real results up to 1000, then shows `"1,000+"`. Never used as episode/season count. |
| **AniList `relations` is 1 hop only** | A mid‑chain season can't see the whole franchise from one response | Server‑side BFS `walkFranchiseChain` (batched, cached 24h). |
| **AniList `episodes` is `null` for airing long‑runners** | One Piece etc. would show no count | Fallback to `nextAiringEpisode.episode - 1`. |
| **AniList has no backdrop / text logo, sparse `bannerImage`** | Hero + detail bg look weak | TMDB backdrop + logo for hero & detail bg. |
| **AniList `streamingEpisodes` coverage is partial** | Missing episode thumbnails/titles | TMDB stills via `…/episodes` (mapped to absolute order). |
| **MegaPlay returns 200 for missing embeds, blocks no‑Referer** | Broken player if trusted blindly | Server‑side HTML probe with `Referer`. |
| **No AniList → Anikoto/MegaPlay id map** | Can't use the `/series` endpoint | Use `stream/ani/{anilistId}` + `stream/mal/{idMal}` fallback. |
| **Announced future seasons count toward `totalSeasons`** | Re:ZERO shows 4 (S4 announced) | By design — it's real franchise data, not aired‑only. Flag if "aired only" is wanted. |
| **`countFranchiseSeasons` split‑season heuristic** | An unusual title scheme could mis‑group by ±1 | Handles Season N / Part N / Cour N / "Final Season"; documented. |

---

## 32. Known edge cases

- **Movies** — card badge = `MOVIE` (no "1 EP"); detail Episodes/Seasons = `—`.
- **Unknown episodes, not airing** — card badge = just the format; detail
  "Episodes" = "Unknown".
- **No score** — rating badge hidden; detail "Score" = "N/A".
- **1000+ episodes** (One Piece) — `TV · 1175 EP`, badge truncates with
  ellipsis if the card is very narrow, never wraps.
- **Standalone movie franchise** — `totalSeasons` falls back to 1 (chain has no
  TV entries).
- **`buildWatchStructure` on the client** still runs for the watch‑page season
  switcher and as the `totalSeasons` fallback.
- **Genre casing** — `/genre/action` and `/genre/Action` both resolve.

---

## 33. Performance considerations

- **No N+1 for cards** — one `/api/anime/home` call feeds ~140 cards; genre /
  search are one call per page. TMDB is called only for the hero‑5 and the
  single detail anime, never per card.
- `useHomeAnime` module cache means `/anime` ↔ `/browse` navigation is free.
- The detail‑page **franchise chain walk adds 1–3 AniList requests** on a cold
  load (cached 24h after). One Piece = 1 (no TV prequel/sequel), Mushoku ≈ 3.
  This is the only added request cost of the change set and is genuinely needed
  for a correct season count.
- The genre **count probe** is a single aliased request, only fired on genre
  navigation, cached 1h, and never blocks the results grid.
- `getTmdbArtwork` for the hero‑5 runs in `Promise.all`.

---

## 34. Current technical debt

1. `app/api/anime/trending/route.ts` — dead endpoint (nothing imports it).
2. `app/components/FeaturedCarousel.tsx` — dead component.
3. Two **pre‑existing** `react-hooks/set-state-in-effect` lint errors
   (`useHomeAnime.ts:86`, `anime/[id]/page.tsx` countdown effect). `next build`
   tolerates them; not touched (unrelated to this change set).
4. `app/anime/[id]/route.ts` still fetches a TMDB `logo` the detail page never
   renders (`<h1>` text is used). Harmless; left for a future cleanup.
5. Watchlist / favourites have no listing page — navbar "Saved"/"Profile"/
   "Alerts" are disabled.
6. `app/page.tsx` ("/") is an unrelated marketing page with a couple of
   hardcoded TMDB image URLs in its feature section.
7. `mostFavorite` section is titled "MOST FAVORITE" but AniList sorts it by
   `FAVOURITES_DESC` — fine, just note the spelling.

---

## 35. Important files & what each does

| File | Responsibility |
|---|---|
| `app/data/anime.ts` | **The** normalisation + derived‑value module. `Anime` type, `mapAniListAnime`, `buildWatchStructure`, `formatScore`, `formatEpisodeMeta`, `countFranchiseSeasons`. |
| `app/data/genres.ts` | Canonical 18‑genre list + `resolveGenre`. |
| `app/api/anime/home/route.ts` | Home payload: 1 AniList query (7 sections + airing schedule) + hero TMDB art. |
| `app/api/anime/browse/route.ts` | Filtered list + `countOnly` accurate‑count probe. |
| `app/api/anime/[id]/route.ts` | One anime + TMDB banner/logo + franchise chain walk → `totalSeasons`. |
| `app/api/anime/[id]/episodes/route.ts` | TMDB per‑episode stills for the watch page. |
| `app/api/anime/watch/route.ts` | Resolve playable sources via a provider. |
| `app/lib/tmdb.ts` | TMDB search / artwork / episode‑image helpers + fallback logo (TheTVDB). |
| `app/lib/providers/anikoto.ts` | MegaPlay provider — probe `stream/ani` then `stream/mal`. |
| `app/lib/providers/index.ts` | Provider registry. |
| `app/components/AnimeCard.tsx` | The card. Rating `formatScore`, badge `formatEpisodeMeta`. |
| `app/components/useHomeAnime.ts` | Shared, module‑cached `/api/anime/home` loader (`heroAnime` + sections). |
| `app/components/AnimeHero.tsx` | Home hero drag carousel (uses `heroAnime`). |
| `app/anime/[id]/page.tsx` | Detail page: stats, actions (Watch/Plan/Share/♥), genre `<Link>`s, toast. |
| `app/genre/[genre]/page.tsx` | Genre results + `GenreFilter` + accurate count. |
| `app/globals.css` | All styling. |

---

## 36. Data‑flow diagrams

### Rating (card & detail)
```
AniList Media.averageScore (0–100)
   │  api/anime/{home,browse,[id],trending}  GraphQL
   ▼
mapAniListAnime → Anime.score : number|null      (stored unscaled)
   │
   ├── AnimeCard          formatScore(score) → "★ 8.7"   (top-left badge)
   ├── LatestEpisodeCard  formatScore(score) → "★ 8.7"   (pill)
   └── /anime/[id]        formatScore(score) → "8.7"     (Stats › Score)
```

### Episode count
```
AniList Media.episodes ─┐
AniList Media.nextAiringEpisode.episode ─┐
                        ▼               ▼
mapAniListAnime:  episodes = Media.episodes ?? (nextAiring ? episode-1 : null)
                        │
                        ├── AnimeCard   formatEpisodeMeta(format, episodes)
                        │                 TV+14 → "TV · 14 EP"
                        │                 MOVIE → "MOVIE"
                        │                 TV+null → "TV"
                        │                 TV+1175 → "TV · 1175 EP"   (One Piece)
                        └── /anime/[id] Stats › Episodes  (movie → "—")
```

### Season count
```
/anime/[id]  ──▶  api/anime/[id]/route.ts
                     │
                     ├─ AniList Media(id).relations            (1 hop, for "Related Media")
                     │
                     └─ walkFranchiseChain(id):
                          frontier = [id]
                          loop:  Page{ media(id_in: frontier){ relations{edges{relationType node{id format}}} } }
                                 keep PREQUEL/SEQUEL edges, node.format ∈ {TV, TV_SHORT}
                          → chain[] (TV entries, by year)
                                 │
                          countFranchiseSeasons(chain)
                                 numbered "Season N"      → distinct N
                                 unnumbered + split parts → adjacent clusters
                                 → Anime.totalSeasons
                     ▼
             /anime/[id]  poster overlay "SEASONS n"  +  Stats › Seasons
             (fallback: buildWatchStructure(anime).seasons.length  — 1 hop)
```

### Home / hero split (the AniList‑card fix)
```
AniList topAiring (20)  ── mapAniListAnime ──▶  topAiring : Anime[20]   (AniList coverImage)
        │  slice(0,5)
        ▼
   + TMDB getTmdbArtwork (poster/banner/logo)
        ▼
   heroAnime : Anime[5]   ───────────────────▶  <AnimeHero>   (TMDB art)

topAiring (full 20, AniList)  ─────────────────▶  <AnimeRow>  →  AnimeCard × 20
```

### Streaming
```
ProviderModal → GET /api/anime/watch?id&episode&type&provider
   → provider.getSources()
        probe megaplay.buzz/stream/ani/{anilistId}/{ep}/{lang}   (Referer set)
        └ error page? → AniList idMal lookup → probe stream/mal/{idMal}/{ep}/{lang}
   → VideoSource[]  → VideoPlayer <iframe>
```

---

## Quick answers

- **Where does the card rating come from?** AniList `Media.averageScore` (0–100),
  shown as `averageScore/10` (`formatScore`).
- **Where does the episode count come from?** AniList `Media.episodes`, falling
  back to `nextAiringEpisode.episode - 1` for airing shows with a null total.
- **Where does the total season count come from?** A server‑side BFS walk of
  AniList `PREQUEL`/`SEQUEL` TV relations (`walkFranchiseChain`) →
  `countFranchiseSeasons`. Not hardcoded, not a relation count, not
  `pagination.total`.
- **Where does the (card / detail) poster come from?** AniList
  `coverImage.large` — for every card **and** the detail poster now.
- **Where does the banner come from?** TMDB backdrop (hero + detail background).
  AniList `bannerImage` is the fallback.
- **Where does the streaming source come from?** MegaPlay / Anikoto
  (`megaplay.buzz/stream/ani|mal/...`), resolved by `api/anime/watch`.
- **Where does genre data come from?** AniList `Media.genres`; the selectable
  list is `app/data/genres.ts` (18 AniList genres).
- **Is TMDB still used?** Yes — hero backdrop + logo (`home` route, hero‑5),
  detail‑page background banner (`[id]` route), and watch‑page per‑episode
  stills/titles (`[id]/episodes` route). **Not for any anime card, and not for
  the detail poster anymore.**
- **Is AniList used?** Yes — it is the source of *all* anime metadata and of
  every anime‑card field, plus the AniList→MAL id used by the streaming
  fallback.
- **Is AniKoto used?** Yes — as "MegaPlay" (`lib/providers/anikoto.ts`), the sole
  streaming provider, called only by `api/anime/watch`. Its `/series` catalogue
  endpoint is deliberately not used.
- **Duplicate / redundant providers?** `api/anime/trending` (dead route,
  duplicates `browse`) and `FeaturedCarousel.tsx` (dead component). No duplicate
  external providers. TMDB and AniList overlap only on artwork, and each is used
  where it is genuinely better.
