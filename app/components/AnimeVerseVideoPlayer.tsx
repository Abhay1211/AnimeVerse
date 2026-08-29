"use client";

import {
    Maximize,
    Minimize,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Settings,
    Subtitles,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { VideoSubtitle } from "../lib/providers/types";

type AnimeVerseVideoPlayerProps = {
    src: string;
    isHLS?: boolean;
    poster?: string | null;
    subtitles?: VideoSubtitle[];
    title?: string;
    reloadToken?: number;
    isFullscreen?: boolean;
    onReady?: () => void;
    onToggleFullscreen?: () => void;
};

const controlButton =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70";

function formatTime(value: number) {
    if (!Number.isFinite(value) || value < 0) return "0:00";

    const seconds = Math.floor(value);
    const minutes = Math.floor(seconds / 60);
    const remainder = String(seconds % 60).padStart(2, "0");

    return `${minutes}:${remainder}`;
}

export default function AnimeVerseVideoPlayer({
    src,
    isHLS = false,
    poster,
    subtitles = [],
    title,
    reloadToken = 0,
    isFullscreen = false,
    onReady,
    onToggleFullscreen,
}: AnimeVerseVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [locked, setLocked] = useState(false);
    const [subtitleColor, setSubtitleColor] = useState("#ffffff");
    const [subtitleOpacity, setSubtitleOpacity] = useState(80);
    const [subtitlePosition, setSubtitlePosition] = useState(85);
    const [hasError, setHasError] = useState(false);

    const wakeControls = () => {
        setShowControls(true);

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (isPlaying && !showSettings && !locked) setShowControls(false);
        }, 2600);
    };

    useEffect(() => {
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setHasError(false);

        let hls: Hls | null = null;
        if (isHLS && Hls.isSupported()) {
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
            });
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) setHasError(true);
            });
        } else {
            video.src = src;
            video.load();
        }

        return () => {
            hls?.destroy();
        };
    }, [src, isHLS, reloadToken]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video || locked) return;

        if (video.paused) {
            void video.play();
        } else {
            video.pause();
        }
        wakeControls();
    };

    const seekBy = (amount: number) => {
        const video = videoRef.current;
        if (!video || locked) return;
        video.currentTime = Math.max(
            0,
            Math.min(video.duration || 0, video.currentTime + amount)
        );
        wakeControls();
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video || locked) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
        wakeControls();
    };

    const changeVolume = (value: number) => {
        const video = videoRef.current;
        if (!video || locked) return;
        video.volume = value;
        video.muted = value === 0;
        setVolume(value);
        setIsMuted(video.muted);
    };

    const controlsVisible = showControls || !isPlaying || showSettings;

    return (
        <div
            className="absolute inset-0 bg-black text-white"
            onMouseMove={wakeControls}
            onTouchStart={wakeControls}
        >
            <video
                ref={videoRef}
                key={`${src}-${reloadToken}`}
                className="absolute inset-0 h-full w-full object-contain"
                src={isHLS && Hls.isSupported() ? undefined : src}
                poster={poster ?? undefined}
                playsInline
                autoPlay
                onLoadedMetadata={(event) => {
                    setDuration(event.currentTarget.duration);
                    onReady?.();
                }}
                onTimeUpdate={(event) =>
                    setCurrentTime(event.currentTarget.currentTime)
                }
                onPlay={() => setIsPlaying(true)}
                onPause={() => {
                    setIsPlaying(false);
                    setShowControls(true);
                }}
                onVolumeChange={(event) => {
                    setVolume(event.currentTarget.volume);
                    setIsMuted(event.currentTarget.muted);
                }}
                onEnded={() => setShowControls(true)}
                onError={() => setHasError(true)}
                aria-label={title ?? "AnimeVerse video"}
            >
                {subtitles.map((subtitle, index) => (
                    <track
                        key={`${subtitle.url}-${subtitle.language}`}
                        kind="subtitles"
                        src={subtitle.url}
                        srcLang={subtitle.language}
                        label={subtitle.language}
                        default={index === 0}
                    />
                ))}
            </video>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/80" />

            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/75 text-sm text-white/70">
                    This video could not be played.
                </div>
            )}

            {!isPlaying && !hasError && !locked && (
                <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/90 shadow-2xl backdrop-blur-sm transition hover:scale-105 hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:h-24 md:w-24"
                    aria-label="Play video"
                >
                    <Play className="ml-1 h-9 w-9 fill-current stroke-[1.25] md:h-11 md:w-11" />
                </button>
            )}

            <button
                type="button"
                onClick={() => setShowSettings((visible) => !visible)}
                className={`absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/75 backdrop-blur-md transition hover:bg-black/60 hover:text-white ${locked ? "opacity-0" : ""}`}
                aria-label="Open player settings"
            >
                <Settings className="h-5 w-5" />
            </button>

            {locked && (
                <button
                    type="button"
                    onClick={() => setLocked(false)}
                    className="absolute right-3 top-3 z-30 rounded-md border border-white/15 bg-black/60 px-3 py-2 text-xs text-white/80 backdrop-blur-md"
                >
                    Unlock
                </button>
            )}

            {showSettings && !locked && (
                <div className="absolute right-3 top-14 z-30 w-[min(19rem,calc(100%-1.5rem))] rounded-lg border border-white/10 bg-[#111]/95 p-4 text-sm shadow-2xl backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                        <span className="font-medium text-white/90">Settings</span>
                        <button
                            type="button"
                            onClick={() => setShowSettings(false)}
                            className="text-white/50 transition hover:text-white"
                            aria-label="Close settings"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setLocked(true);
                            setShowSettings(false);
                        }}
                        className="mb-4 flex w-full items-center justify-between text-left text-white/80 hover:text-white"
                    >
                        <span>Lock Screen</span>
                        <span className="text-xs text-white/35">OFF</span>
                    </button>

                    <div className="space-y-4 text-xs text-white/60">
                        <div>
                            <div className="mb-2 flex justify-between">
                                <span>Subtitle color</span>
                                <span style={{ color: subtitleColor }}>Aa</span>
                            </div>
                            <div className="flex gap-2">
                                {["#ffffff", "#facc15", "#93c5fd", "#86efac"].map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setSubtitleColor(color)}
                                        className={`h-6 w-6 rounded-full border-2 ${subtitleColor === color ? "border-white" : "border-transparent"}`}
                                        style={{ backgroundColor: color }}
                                        aria-label={`Select subtitle color ${color}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <label className="block">
                            <span className="mb-2 flex justify-between"><span>Subtitle background</span><span>{subtitleOpacity}%</span></span>
                            <input className="w-full accent-white" type="range" min="0" max="100" value={subtitleOpacity} onChange={(event) => setSubtitleOpacity(Number(event.target.value))} />
                        </label>

                        <label className="block">
                            <span className="mb-2 flex justify-between"><span>Subtitle position</span><span>{subtitlePosition}%</span></span>
                            <input className="w-full accent-white" type="range" min="60" max="95" value={subtitlePosition} onChange={(event) => setSubtitlePosition(Number(event.target.value))} />
                        </label>

                        <p className="border-t border-white/10 pt-3 text-[11px] text-white/35">
                            Subtitles become available when this source provides a track.
                        </p>
                    </div>
                </div>
            )}

            <div
                className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-12 transition-opacity duration-300 md:px-4 md:pb-4 ${controlsVisible && !locked ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => {
                        const video = videoRef.current;
                        if (!video) return;
                        video.currentTime = Number(event.target.value);
                        wakeControls();
                    }}
                    className="mb-2 h-1 w-full cursor-pointer accent-white"
                    aria-label="Seek video"
                />

                <div className="flex items-center gap-1 text-xs text-white/70 md:gap-2">
                    <button type="button" onClick={togglePlay} className={controlButton} aria-label={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                    </button>
                    <button type="button" onClick={() => seekBy(-10)} className={controlButton} aria-label="Rewind 10 seconds"><RotateCcw className="h-4 w-4" /></button>
                    <button type="button" onClick={() => seekBy(10)} className={controlButton} aria-label="Forward 10 seconds"><RotateCw className="h-4 w-4" /></button>
                    <span className="ml-1 min-w-[5.5rem] font-mono text-[11px] text-white/70">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    <div className="ml-auto flex items-center gap-1">
                        <button type="button" onClick={() => setShowSettings(true)} className={`${controlButton} hidden sm:flex`} aria-label="Subtitles"><Subtitles className="h-4 w-4" /></button>
                        <span className="hidden rounded bg-white px-2 py-1 text-[10px] font-bold text-black sm:inline-block">AUTO</span>
                        <button type="button" onClick={toggleMute} className={controlButton} aria-label={isMuted ? "Unmute" : "Mute"}>{isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
                        <input className="hidden w-16 accent-white md:block" type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} aria-label="Volume" />
                        <button type="button" onClick={onToggleFullscreen} className={controlButton} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
