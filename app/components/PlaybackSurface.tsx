"use client";

import type { VideoSourceKind } from "../lib/providers/types";
import type { VideoSubtitle } from "../lib/providers/types";
import AnimeVerseVideoPlayer from "./AnimeVerseVideoPlayer";

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
 * The direct implementation is AnimeVerseVideoPlayer, kept separate from
 * the iframe branch so cross-origin MegaPlay behavior remains unchanged.
 * The public shape below is intentionally small so that change stays local.
 */

export type PlaybackImplementation = VideoSourceKind;

export type PlaybackSurfaceProps = {
    /** Which playback implementation to render. */
    implementation?: PlaybackImplementation;

    /** Playback URL. For "iframe" this is the cross-origin embed URL. */
    url: string;
    isHLS?: boolean;

    /** Accessible title for the surface. */
    title?: string;

    /**
     * Change this value to force the surface to fully re-mount (used by the
     * "reload" affordance and when the episode/source changes).
     */
    reloadToken?: number;

    /** Fired once the surface has finished its initial load. */
    onReady?: () => void;

    /** Poster used by the direct AnimeVerse-owned player. */
    poster?: string | null;

    /** Subtitle tracks supplied by a direct-media resolver. */
    subtitles?: VideoSubtitle[];

    /** Fullscreen state/action owned by the outer player shell. */
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;

    /** Episode navigation actions for the direct player controls. */
    onPreviousEpisode?: () => void;
    onNextEpisode?: () => void;
    resumeTime?: number | null;
    onPlaybackReady?: (duration: number) => void;
    onPlaybackTimeUpdate?: (currentTime: number, duration: number) => void;
    onPlaybackPause?: (currentTime: number, duration: number) => void;
};

export default function PlaybackSurface({
    implementation = "iframe",
    url,
    isHLS = false,
    title,
    reloadToken = 0,
    onReady,
    poster,
    subtitles,
    isFullscreen,
    onToggleFullscreen,
    onPreviousEpisode,
    onNextEpisode,
    resumeTime,
    onPlaybackReady,
    onPlaybackTimeUpdate,
    onPlaybackPause,
}: PlaybackSurfaceProps) {
    if (implementation === "iframe") {
        return (
            <iframe
                key={reloadToken}
                src={url}
                title={title ?? "Video player"}
                width="100%"
                height="100%"
                className="absolute inset-0 h-full w-full"
                style={{ aspectRatio: "16 / 9", border: 0 }}
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; screen-wake-lock"
                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                allowFullScreen
                referrerPolicy="origin"
                onLoad={onReady}
            />
        );
    }

    if (implementation === "direct") {
        return (
            <AnimeVerseVideoPlayer
                src={url}
                isHLS={isHLS}
                poster={poster}
                subtitles={subtitles}
                title={title}
                reloadToken={reloadToken}
                isFullscreen={isFullscreen}
                onReady={onReady}
                onToggleFullscreen={onToggleFullscreen}
                onPreviousEpisode={onPreviousEpisode}
                onNextEpisode={onNextEpisode}
                resumeTime={resumeTime}
                onPlaybackReady={onPlaybackReady}
                onPlaybackTimeUpdate={onPlaybackTimeUpdate}
                onPlaybackPause={onPlaybackPause}
            />
        );
    }

    return null;
}
