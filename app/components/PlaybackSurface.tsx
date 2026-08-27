"use client";

/**
 * PlaybackSurface — the swappable playback layer that lives inside VideoPlayer.
 *
 * This is the seam that lets us replace the playback implementation later
 * WITHOUT touching the watch page, EpisodeRail, episode navigation, the host
 * controls, the comments block or the page layout. Those only ever talk to
 * <VideoPlayer>; <VideoPlayer> only ever talks to <PlaybackSurface>.
 *
 * Today the only implementation is "iframe" — the cross-origin MegaPlay embed.
 * Because it is cross-origin we cannot read or drive its playback, so
 * VideoPlayer renders no controls layer over it (MegaPlay draws its own).
 *
 * A later milestone adds implementation === "html5" (an <video> element, later
 * fed by HLS.js) and mounts a real controls layer as a sibling of the surface.
 * The public shape below is intentionally small so that change stays local.
 */

export type PlaybackImplementation = "iframe"; // later: | "html5"

export type PlaybackSurfaceProps = {
    /** Which playback implementation to render. Only "iframe" is wired today. */
    implementation?: PlaybackImplementation;

    /** Playback URL. For "iframe" this is the cross-origin embed URL. */
    url: string;

    /** Accessible title for the surface. */
    title?: string;

    /**
     * Change this value to force the surface to fully re-mount (used by the
     * "reload" affordance and when the episode/source changes).
     */
    reloadToken?: number;

    /** Fired once the surface has finished its initial load. */
    onReady?: () => void;
};

export default function PlaybackSurface({
    implementation = "iframe",
    url,
    title,
    reloadToken = 0,
    onReady,
}: PlaybackSurfaceProps) {
    if (implementation === "iframe") {
        return (
            <iframe
                key={reloadToken}
                src={url}
                title={title ?? "Video player"}
                className="absolute inset-0 h-full w-full border-0"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                referrerPolicy="origin"
                onLoad={onReady}
            />
        );
    }

    return null;
}
