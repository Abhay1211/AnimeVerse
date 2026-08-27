/**
 * Shared typography + control styling for the watch-page UI.
 *
 * Video Hosts, the Sub/Dub + Server controls, Seasons, the Episodes heading
 * and its search box all pull their font family, size, weight, padding, height
 * and radius from here so they read as one monospace design system rather than
 * each component picking its own values.
 *
 * `font-mono` resolves to JetBrains Mono via the `@theme` override in
 * globals.css — the same face the rest of AnimeVerse uses.
 */

/** Section headings: "Video Hosts", "Seasons", "Episodes". */
export const watchSectionHeading =
    "font-mono text-sm font-bold tracking-tight text-white";

/** Small muted caps label that sits beside a control group, e.g. "SERVER". */
export const watchMutedLabel =
    "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/30";

/** Secondary metadata line under a title. */
export const watchMeta = "font-mono text-[10px] text-white/40";

const PILL_BASE =
    "rounded-lg border px-3 py-1.5 font-mono text-xs font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

const PILL_ACTIVE =
    "border-white bg-white font-semibold text-black shadow-[0_0_12px_rgba(255,255,255,0.22)]";

const PILL_INACTIVE =
    "border-white/12 bg-white/[0.03] text-white/55 hover:border-white/30 hover:bg-white/[0.06] hover:text-white";

/**
 * The one pill button used for language, server and season selection.
 * `interactive` adds the hand cursor — pass `false` for a non-clickable
 * current-state element rendered with the active look.
 */
export function watchPill(active: boolean, interactive = true): string {
    return [
        interactive ? "cursor-pointer" : "",
        PILL_BASE,
        active ? PILL_ACTIVE : PILL_INACTIVE,
    ]
        .filter(Boolean)
        .join(" ");
}

/** Episode search field — same family / height / radius as the pills. */
export const watchSearchInput =
    "h-9 w-full rounded-lg border border-white/12 bg-white/[0.03] pl-8 pr-3 font-mono text-xs font-normal tracking-normal text-white outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-white/35 focus:border-white/25";
