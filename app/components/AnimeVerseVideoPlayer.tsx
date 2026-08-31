"use client";

import {
    Check,
    Lock,
    Maximize,
    Minimize,
    ChevronLeft,
    ChevronRight,
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
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
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
    onPreviousEpisode?: () => void;
    onNextEpisode?: () => void;
    resumeTime?: number | null;
    onPlaybackReady?: (duration: number) => void;
    onPlaybackTimeUpdate?: (currentTime: number, duration: number) => void;
    onPlaybackPause?: (currentTime: number, duration: number) => void;
};

type QualityLevel = { index: number; height: number; bitrate: number };
type SubtitleSettings = { color: string; opacity: number; position: number; size: number };

// Stable identity for the "no subtitles" case so the render-phase reset below
// doesn't loop when the prop is omitted.
const EMPTY_SUBTITLES: VideoSubtitle[] = [];

function readSubtitleSettings(): SubtitleSettings {
    const defaults = { color: "#ffffff", opacity: 0, position: 90, size: 100 };
    if (typeof window === "undefined") return defaults;

    try {
        const stored = window.localStorage.getItem("animeverse:subtitle-settings");
        if (!stored) return defaults;
        const settings = JSON.parse(stored) as Partial<SubtitleSettings>;
        return {
            color: typeof settings.color === "string" ? settings.color : defaults.color,
            opacity: typeof settings.opacity === "number" ? Math.max(0, Math.min(100, settings.opacity)) : defaults.opacity,
            position: typeof settings.position === "number" ? Math.max(0, Math.min(100, settings.position)) : defaults.position,
            size: typeof settings.size === "number" ? Math.max(50, Math.min(150, settings.size)) : defaults.size,
        };
    } catch {
        return defaults;
    }
}

function getDefaultSubtitleIndex(subtitles: VideoSubtitle[]): number | "off" {
    const englishIndex = subtitles.findIndex(({ language }) => {
        const normalized = language.trim().toLowerCase();
        return (
            normalized === "en" ||
            normalized === "eng" ||
            normalized.startsWith("en-") ||
            normalized.includes("english")
        );
    });

    return englishIndex >= 0
        ? englishIndex
        : subtitles.length > 0
        ? 0
        : "off";
}

const controlButton =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70";

function formatTime(value: number) {
    if (!Number.isFinite(value) || value < 0) return "0:00";

    const seconds = Math.floor(value);
    const minutes = Math.floor(seconds / 60);
    const remainder = String(seconds % 60).padStart(2, "0");

    return `${minutes}:${remainder}`;
}

function formatQuality(level: QualityLevel): string {
    return level.height
        ? `${level.height}p`
        : level.bitrate
        ? `${Math.round(level.bitrate / 1000)}k`
        : "Unknown";
}

export default function AnimeVerseVideoPlayer({
    src,
    isHLS = false,
    poster,
    subtitles = EMPTY_SUBTITLES,
    title,
    reloadToken = 0,
    isFullscreen = false,
    onReady,
    onToggleFullscreen,
    onPreviousEpisode,
    onNextEpisode,
    resumeTime = null,
    onPlaybackReady,
    onPlaybackTimeUpdate,
    onPlaybackPause,
}: AnimeVerseVideoPlayerProps) {
    const playerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastClickRef = useRef(0);
    const pointerOverRef = useRef(false);
    const isFullscreenRef = useRef(isFullscreen);
    const suppressPointerWakeRef = useRef(false);
    const keepControlsRef = useRef(false);
    const autoAdvancedRef = useRef(false);
    const activeSubtitleRef = useRef<number | "off">("off");
    const mediaReadyRef = useRef<{ key: string; duration: number } | null>(null);
    const resumeAppliedKeyRef = useRef<string | null>(null);

    const volumeWrapRef = useRef<HTMLDivElement>(null);
    const subtitleWrapRef = useRef<HTMLDivElement>(null);
    const qualityWrapRef = useRef<HTMLDivElement>(null);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const keyboardActionsRef = useRef<{
        togglePlay: () => void;
        seekBy: (amount: number) => void;
        changeVolume: (value: number) => void;
        toggleMute: () => void;
        wakeControls: () => void;
        toggleFullscreen: () => void;
        isFullscreen: boolean;
        volume: number;
        locked: boolean;
    } | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [locked, setLocked] = useState(false);
    const [subtitleColor, setSubtitleColor] = useState(() => readSubtitleSettings().color);
    const [subtitleOpacity, setSubtitleOpacity] = useState(() => readSubtitleSettings().opacity);
    const [subtitlePosition, setSubtitlePosition] = useState(() => readSubtitleSettings().position);
    const [subtitleSize, setSubtitleSize] = useState(() => readSubtitleSettings().size);
    const [activeCueText, setActiveCueText] = useState<string[]>([]);
    const [hasError, setHasError] = useState(false);

    const [isCoarsePointer, setIsCoarsePointer] = useState(false);
    const [volumeSliderOpen, setVolumeSliderOpen] = useState(false);
    const [autoNext, setAutoNext] = useState<boolean>(() => {
        try {
            const stored = window.localStorage.getItem("animeverse:auto-next");
            if (stored !== null) return stored === "1";
        } catch {
            /* storage unavailable — keep the default */
        }
        return true;
    });
    const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | "off">(
        getDefaultSubtitleIndex(subtitles)
    );
    const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
    const [levels, setLevels] = useState<QualityLevel[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1);

    // Reset the subtitle selection when the source's track list changes.
    // (React's "adjust state during render" pattern — no effect needed.)
    const [trackedSubtitles, setTrackedSubtitles] = useState(subtitles);
    if (subtitles !== trackedSubtitles) {
        setTrackedSubtitles(subtitles);
        setActiveSubtitleIndex(getDefaultSubtitleIndex(subtitles));
    }

    useEffect(() => {
        keepControlsRef.current =
            showSettings ||
            subtitleMenuOpen ||
            qualityMenuOpen ||
            volumeSliderOpen;
    }, [showSettings, subtitleMenuOpen, qualityMenuOpen, volumeSliderOpen]);

    useEffect(() => {
        activeSubtitleRef.current = activeSubtitleIndex;
    }, [activeSubtitleIndex]);

    useEffect(() => {
        isFullscreenRef.current = isFullscreen;
    }, [isFullscreen]);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                "animeverse:subtitle-settings",
                JSON.stringify({
                    color: subtitleColor,
                    opacity: subtitleOpacity,
                    position: subtitlePosition,
                    size: subtitleSize,
                })
            );
        } catch {
            /* storage unavailable — keep settings for this session */
        }
    }, [subtitleColor, subtitleOpacity, subtitlePosition, subtitleSize]);

    // Detect hover-less (touch) devices so the volume control can switch to a
    // tap-to-toggle interaction instead of relying on hover.
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;

        const query = window.matchMedia("(hover: none)");
        const update = () => setIsCoarsePointer(query.matches);

        update();
        query.addEventListener("change", update);

        return () => query.removeEventListener("change", update);
    }, []);

    const toggleAutoNext = () => {
        setAutoNext((enabled) => {
            const next = !enabled;
            try {
                window.localStorage.setItem(
                    "animeverse:auto-next",
                    next ? "1" : "0"
                );
            } catch {
                /* ignore */
            }
            return next;
        });
    };

    const wakeControls = useCallback(() => {
        if (locked) return;
        setShowControls(true);

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (
                !keepControlsRef.current &&
                !locked &&
                (isFullscreenRef.current || !pointerOverRef.current)
            ) {
                setShowControls(false);
            }
        }, 2600);
    }, [locked]);

    const handleMouseEnter = () => {
        if (suppressPointerWakeRef.current) return;
        pointerOverRef.current = true;
        wakeControls();
    };

    const handleMouseLeave = () => {
        pointerOverRef.current = false;
        if (suppressPointerWakeRef.current) return;
        wakeControls();
    };

    const handleTouchStart = () => {
        suppressPointerWakeRef.current = false;
        pointerOverRef.current = false;
        wakeControls();
    };

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        if (suppressPointerWakeRef.current) {
            if (event.movementX === 0 && event.movementY === 0) return;
            suppressPointerWakeRef.current = false;
        }
        wakeControls();
    };

    useEffect(() => {
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const clearControlTimer = () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };
        const handleVisibilityChange = () => {
            clearControlTimer();
            if (document.visibilityState === "hidden") {
                setShowControls(false);
                suppressPointerWakeRef.current = true;
                return;
            }

            if (isFullscreenRef.current) {
                setShowControls(false);
                suppressPointerWakeRef.current = true;
            }
        };
        const handleWindowBlur = () => {
            clearControlTimer();
            if (isFullscreenRef.current) setShowControls(false);
            suppressPointerWakeRef.current = true;
        };
        const handleWindowFocus = () => {
            clearControlTimer();
            if (isFullscreenRef.current) {
                setShowControls(false);
                suppressPointerWakeRef.current = true;
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("focus", handleWindowFocus);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleWindowBlur);
            window.removeEventListener("focus", handleWindowFocus);
        };
    }, []);

    useEffect(() => {
        if (isFullscreen) return;
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
        suppressPointerWakeRef.current = false;
    }, [isFullscreen]);

    // Close the pop-over menus (and the touch volume slider) on an outside press.
    useEffect(() => {
        if (!showSettings && !subtitleMenuOpen && !qualityMenuOpen && !volumeSliderOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (subtitleWrapRef.current?.contains(target)) return;
            if (qualityWrapRef.current?.contains(target)) return;
            if (volumeWrapRef.current?.contains(target)) return;
            if (settingsPanelRef.current?.contains(target)) return;

            setShowSettings(false);
            setSubtitleMenuOpen(false);
            setQualityMenuOpen(false);
            setVolumeSliderOpen(false);
        };

        document.addEventListener("pointerdown", handlePointerDown, true);

        return () =>
            document.removeEventListener(
                "pointerdown",
                handlePointerDown,
                true
            );
    }, [showSettings, subtitleMenuOpen, qualityMenuOpen, volumeSliderOpen]);

    // Drive the native <track> elements that already render below the <video>.
    const applySubtitleSelection = useCallback((selection: number | "off") => {
        const video = videoRef.current;
        if (!video) return;

        const tracks = video.textTracks;
        for (let index = 0; index < tracks.length; index += 1) {
            tracks[index].mode =
                selection !== "off" && index === selection
                    ? "hidden"
                    : "disabled";
        }
    }, []);

    const updateActiveCueText = useCallback(() => {
        const video = videoRef.current;
        if (!video || activeSubtitleIndex === "off") {
            setActiveCueText([]);
            return;
        }

        const track = video.textTracks[activeSubtitleIndex];
        const cues = track?.activeCues;
        if (!cues) {
            setActiveCueText([]);
            return;
        }

        setActiveCueText(Array.from(cues).map((cue) => (cue as VTTCue).text.replace(/<[^>]*>/g, "").trim()));
    }, [activeSubtitleIndex]);

    // Keep the native <track> modes in sync with the current selection.
    useEffect(() => {
        applySubtitleSelection(activeSubtitleIndex);
    }, [subtitles, activeSubtitleIndex, applySubtitleSelection]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const tracks = Array.from(video.textTracks);
        tracks.forEach((track) => track.addEventListener("cuechange", updateActiveCueText));

        return () => {
            tracks.forEach((track) => track.removeEventListener("cuechange", updateActiveCueText));
        };
    }, [src, reloadToken, subtitles, updateActiveCueText]);

    const selectSubtitle = (selection: number | "off") => {
        setActiveSubtitleIndex(selection);
        applySubtitleSelection(selection);
        if (selection === "off") setActiveCueText([]);
        setSubtitleMenuOpen(false);
        wakeControls();
    };

    const changeQuality = (levelIndex: number) => {
        const hls = hlsRef.current;
        if (!hls) return;

        // -1 re-enables adaptive selection; any other index pins that variant.
        hls.currentLevel = levelIndex;
        setCurrentLevel(levelIndex);
        setQualityMenuOpen(false);
        wakeControls();
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setHasError(false);
        setLevels([]);
        setCurrentLevel(-1);
        autoAdvancedRef.current = false;

        let hls: Hls | null = null;
        if (isHLS && Hls.isSupported()) {
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
            });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                const parsed: QualityLevel[] = (data.levels ?? []).map(
                    (level, index) => ({
                        index,
                        height: level.height ?? 0,
                        bitrate: level.bitrate ?? 0,
                    })
                );
                setLevels(parsed);
                setCurrentLevel(
                    hls && !hls.autoLevelEnabled ? hls.currentLevel : -1
                );
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                setCurrentLevel(
                    hls && !hls.autoLevelEnabled ? data.level : -1
                );
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) setHasError(true);
            });
        } else {
            hlsRef.current = null;
            video.src = src;
            video.load();
        }

        return () => {
            hls?.destroy();
            hlsRef.current = null;
        };
    }, [src, isHLS, reloadToken]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video || locked) return;

        if (video.paused) {
            void video.play();
        } else {
            video.pause();
        }
        wakeControls();
    }, [locked, wakeControls]);

    const seekBy = useCallback((amount: number) => {
        const video = videoRef.current;
        if (!video || locked) return;
        video.currentTime = Math.max(
            0,
            Math.min(video.duration || 0, video.currentTime + amount)
        );
        wakeControls();
    }, [locked, wakeControls]);

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video || locked) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
        wakeControls();
    }, [locked, wakeControls]);

    const changeVolume = useCallback((value: number) => {
        const video = videoRef.current;
        if (!video || locked) return;
        video.volume = value;
        video.muted = value === 0;
        setVolume(value);
        setIsMuted(video.muted);
    }, [locked]);

    // Fullscreen entry point. On iPhone the Fullscreen API is not available on
    // elements, but the <video> exposes `webkitEnterFullscreen()` once its
    // metadata has loaded — use that. Everywhere else (Android, desktop) defer
    // to the page-level container fullscreen owned by <VideoPlayer>. Degrades
    // to a no-op when neither path exists.
    const requestFullscreen = useCallback(() => {
        const video = videoRef.current as
            | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
            | null;
        const canPageFullscreen =
            typeof document !== "undefined" && document.fullscreenEnabled;

        if (
            !canPageFullscreen &&
            video &&
            typeof video.webkitEnterFullscreen === "function" &&
            video.readyState >= 1
        ) {
            try {
                video.webkitEnterFullscreen();
                return;
            } catch {
                /* fall through to the page-level handler */
            }
        }

        onToggleFullscreen?.();
    }, [onToggleFullscreen]);

    useEffect(() => {
        keyboardActionsRef.current = {
            togglePlay,
            seekBy,
            changeVolume,
            toggleMute,
            wakeControls,
            toggleFullscreen: requestFullscreen,
            isFullscreen,
            volume,
            locked,
        };
    }, [
        changeVolume,
        isFullscreen,
        locked,
        requestFullscreen,
        seekBy,
        toggleMute,
        togglePlay,
        volume,
        wakeControls,
    ]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const player = playerRef.current;
            const target = event.target as HTMLElement | null;
            const actions = keyboardActionsRef.current;
            if (!player || !target || !actions) return;

            if (
                target.closest(
                    "input, textarea, select, [contenteditable=\"true\"]"
                )
            ) {
                return;
            }

            const focusInsidePlayer = player.contains(document.activeElement);
            const focusOutsidePlayer =
                document.activeElement && !focusInsidePlayer && document.activeElement !== document.body;
            if ((!player.matches(":hover") && !focusInsidePlayer) || focusOutsidePlayer) {
                return;
            }

            const key = event.key.toLowerCase();

            if (key === "escape") {
                if (actions.isFullscreen) {
                    event.preventDefault();
                    actions.wakeControls();
                    actions.toggleFullscreen();
                }
                return;
            }

            if (
                key === "arrowleft" ||
                key === "arrowright" ||
                key === "arrowup" ||
                key === "arrowdown" ||
                event.code === "Space" ||
                key === "k" ||
                key === "m" ||
                key === "f"
            ) {
                event.preventDefault();
            }

            switch (key) {
                case "arrowleft":
                    actions.seekBy(-10);
                    break;
                case "arrowright":
                    actions.seekBy(10);
                    break;
                case "arrowup": {
                    const video = videoRef.current;
                    actions.changeVolume(
                        Math.min(1, (video?.volume ?? actions.volume) + 0.1)
                    );
                    break;
                }
                case "arrowdown": {
                    const video = videoRef.current;
                    actions.changeVolume(
                        Math.max(0, (video?.volume ?? actions.volume) - 0.1)
                    );
                    break;
                }
                case " ":
                case "k":
                    actions.togglePlay();
                    break;
                case "m":
                    actions.toggleMute();
                    break;
                case "f":
                    if (actions.locked) break;
                    actions.wakeControls();
                    actions.toggleFullscreen();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleVolumeButton = () => {
        // Touch devices have no hover, so the icon toggles the slider instead.
        if (isCoarsePointer) {
            setVolumeSliderOpen((open) => !open);
            wakeControls();
            return;
        }
        toggleMute();
    };

    const clearPendingClick = () => {
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
    };

    // Single click/tap on the video → play/pause. Double click/tap → fullscreen.
    const handleSurfaceClick = () => {
        if (locked) return;

        const now = Date.now();
        if (now - lastClickRef.current < 280) {
            lastClickRef.current = 0;
            clearPendingClick();
            requestFullscreen();
            return;
        }

        lastClickRef.current = now;
        clearPendingClick();
        clickTimerRef.current = setTimeout(() => {
            clickTimerRef.current = null;
            togglePlay();
        }, 280);
    };

    const mediaKey = `${src}-${reloadToken}`;

    const applyResumePosition = useCallback(
        (video: HTMLVideoElement, durationValue: number) => {
            if (resumeTime === null || resumeTime === undefined) return;
            if (resumeAppliedKeyRef.current === mediaKey) return;

            resumeAppliedKeyRef.current = mediaKey;

            if (
                !Number.isFinite(resumeTime) ||
                resumeTime < 0 ||
                !Number.isFinite(durationValue) ||
                durationValue <= 0 ||
                resumeTime >= durationValue ||
                durationValue - resumeTime <= 10
            ) {
                return;
            }

            video.currentTime = resumeTime;
        },
        [mediaKey, resumeTime]
    );

    useEffect(() => {
        const ready = mediaReadyRef.current;
        const video = videoRef.current;
        if (!ready || ready.key !== mediaKey || !video) return;

        applyResumePosition(video, ready.duration);
    }, [applyResumePosition, mediaKey]);

    const controlsVisible =
        showControls || showSettings || subtitleMenuOpen || qualityMenuOpen;
    // The subtitle overlay is positioned against the full player viewport.
    // Controls are an overlay and must not reduce the available subtitle range.
    const subtitleBottom = Math.min(
        88,
        Math.max(1, 88 - subtitlePosition * 0.87)
    );

    const timelineProgress = duration > 0
        ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
        : 0;

    const sortedLevels = [...levels].sort(
        (a, b) => b.height - a.height || b.bitrate - a.bitrate
    );
    const qualityAvailable = levels.length >= 2;
    const activeLevel = currentLevel >= 0 ? levels[currentLevel] : undefined;
    const qualityLabel = levels.length === 1
        ? formatQuality(levels[0])
        : activeLevel
        ? formatQuality(activeLevel)
        : levels.length > 1
        ? "AUTO"
        : "—";
    const qualityTitle = levels.length === 1
        ? `Only one quality available (${formatQuality(levels[0])})`
        : qualityAvailable
        ? "Video quality"
        : "Quality information unavailable";

    const popoverClass =
        "absolute bottom-full right-0 mb-2 min-w-[9rem] overflow-hidden rounded-lg border border-white/10 bg-[#111]/95 p-1 text-xs shadow-2xl backdrop-blur-xl";
    const popoverItem = (active: boolean) =>
        `flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition ${
            active
                ? "bg-white/15 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
        }`;

    return (
        <div
            ref={playerRef}
            className="absolute inset-0 bg-black text-white"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
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
                    const video = event.currentTarget;
                    const durationValue = video.duration;
                    mediaReadyRef.current = { key: mediaKey, duration: durationValue };
                    setDuration(durationValue);
                    applyResumePosition(video, durationValue);
                    applySubtitleSelection(activeSubtitleRef.current);
                    updateActiveCueText();
                    onPlaybackReady?.(durationValue);
                    onReady?.();
                }}
                onClick={handleSurfaceClick}
                onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    setCurrentTime(video.currentTime);
                    updateActiveCueText();
                    onPlaybackTimeUpdate?.(video.currentTime, video.duration);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => {
                    setIsPlaying(false);
                    setShowControls(true);
                    const video = videoRef.current;
                    if (video) onPlaybackPause?.(video.currentTime, video.duration);
                }}
                onVolumeChange={(event) => {
                    setVolume(event.currentTarget.volume);
                    setIsMuted(event.currentTarget.muted);
                }}
                onEnded={(event) => {
                    setShowControls(true);
                    onPlaybackPause?.(event.currentTarget.currentTime, event.currentTarget.duration);

                    if (
                        autoNext &&
                        onNextEpisode &&
                        !autoAdvancedRef.current
                    ) {
                        autoAdvancedRef.current = true;
                        onNextEpisode();
                    }
                }}
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
                        default={index === getDefaultSubtitleIndex(subtitles)}
                    />
                ))}
            </video>

            {activeCueText.length > 0 && activeSubtitleIndex !== "off" && (
                <div
                    className="pointer-events-none absolute inset-x-0 z-[5] flex justify-center px-4 transition-[bottom] duration-200 ease-out"
                    style={{ bottom: `${subtitleBottom}%` }}
                    aria-live="polite"
                >
                    <span
                        className="max-w-[90%] whitespace-pre-line px-2 py-1 text-center text-base font-medium leading-tight md:text-lg"
                        style={{
                            color: subtitleColor,
                            backgroundColor: `rgba(0, 0, 0, ${subtitleOpacity / 100})`,
                            fontSize: subtitleSize === 100 ? undefined : `${subtitleSize}%`,
                            textShadow: "0 1px 3px rgba(0, 0, 0, 0.95)",
                        }}
                    >
                        {activeCueText.join("\n")}
                    </span>
                </div>
            )}

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
                disabled={locked}
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
                <div ref={settingsPanelRef} className="absolute right-3 top-14 z-30 max-h-[calc(100%-4.5rem)] w-[min(78vw,240px)] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/90 p-4 font-mono text-xs shadow-2xl backdrop-blur-md">
                    <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                        <span className="text-xs font-bold tracking-[0.14em] text-white/90">Settings</span>
                        <button
                            type="button"
                            onClick={() => setShowSettings(false)}
                            className="text-white/50 transition hover:text-white"
                            aria-label="Close settings"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-white/40">
                        SUBTITLES
                    </p>

                    <button
                        type="button"
                        onClick={() => {
                            setLocked(true);
                            setShowSettings(false);
                        }}
                        className="mb-3 flex h-8 w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-2.5 text-left text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                        <span className="flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5 text-white/65" />
                            <span>Lock Screen</span>
                        </span>
                        <span className="text-[10px] text-white/35">LOCK</span>
                    </button>

                    {/* Playback controls that live in the control bar on >=sm
                        screens but are hidden there on mobile — surfaced here so
                        every player control stays reachable at 360–412px. */}
                    <div className="mb-3 space-y-3 border-b border-white/10 pb-3 sm:hidden">
                        <div>
                            <p className="mb-1.5 text-[10px] font-bold tracking-[0.18em] text-white/40">
                                SUBTITLE TRACK
                            </p>
                            <div className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => selectSubtitle("off")}
                                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[11px] transition ${activeSubtitleIndex === "off" ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10"}`}
                                >
                                    <span>Off</span>
                                    {activeSubtitleIndex === "off" && (
                                        <Check className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                </button>
                                {subtitles.map((subtitle, index) => (
                                    <button
                                        key={`settings-sub-${subtitle.url}-${index}`}
                                        type="button"
                                        onClick={() => selectSubtitle(index)}
                                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[11px] transition ${activeSubtitleIndex === index ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10"}`}
                                    >
                                        <span className="truncate">
                                            {subtitle.language || `Track ${index + 1}`}
                                        </span>
                                        {activeSubtitleIndex === index && (
                                            <Check className="h-3.5 w-3.5 shrink-0" />
                                        )}
                                    </button>
                                ))}
                                {subtitles.length === 0 && (
                                    <p className="px-2.5 py-1.5 text-[11px] text-white/35">
                                        No subtitles for this source
                                    </p>
                                )}
                            </div>
                        </div>

                        {levels.length > 0 && (
                            <div>
                                <p className="mb-1.5 text-[10px] font-bold tracking-[0.18em] text-white/40">
                                    QUALITY
                                </p>
                                {qualityAvailable ? (
                                    <div className="space-y-1">
                                        <button
                                            type="button"
                                            onClick={() => changeQuality(-1)}
                                            className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[11px] transition ${currentLevel < 0 ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10"}`}
                                        >
                                            <span>Auto</span>
                                            {currentLevel < 0 && (
                                                <Check className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                        </button>
                                        {sortedLevels.map((level) => (
                                            <button
                                                key={`settings-q-${level.index}`}
                                                type="button"
                                                onClick={() => changeQuality(level.index)}
                                                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[11px] transition ${currentLevel === level.index ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10"}`}
                                            >
                                                <span>{formatQuality(level)}</span>
                                                {currentLevel === level.index && (
                                                    <Check className="h-3.5 w-3.5 shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="px-2.5 py-1.5 text-[11px] text-white/35">
                                        {levels.length === 1
                                            ? `Only ${formatQuality(levels[0])} available`
                                            : "Quality unavailable"}
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={toggleAutoNext}
                            aria-pressed={autoNext}
                            className="flex h-8 w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-2.5 text-left text-[11px] text-white/80 transition hover:bg-white/10"
                        >
                            <span>Autoplay next episode</span>
                            <span className={`text-[10px] font-bold ${autoNext ? "text-white" : "text-white/35"}`}>
                                {autoNext ? "ON" : "OFF"}
                            </span>
                        </button>
                    </div>

                    <div className="space-y-3 text-[11px] text-white/60">
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <span>Color</span>
                                <span className="text-xs font-bold" style={{ color: subtitleColor }}>Aa</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {["#ffffff", "#facc15", "#86efac", "#93c5fd", "#f472b6"].map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setSubtitleColor(color)}
                                        className={`h-6 w-6 rounded-full border-2 transition ${subtitleColor === color ? "border-white" : "border-transparent"}`}
                                        style={{ backgroundColor: color }}
                                        aria-label={`Select subtitle color ${color}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <label className="block">
                            <span className="mb-2 flex justify-between"><span>BG Opacity</span><span>{subtitleOpacity}%</span></span>
                            <input className="h-1 w-full accent-white" type="range" min="0" max="100" value={subtitleOpacity} onChange={(event) => setSubtitleOpacity(Number(event.target.value))} />
                        </label>

                        <label className="block">
                            <span className="mb-2 flex justify-between"><span>Position</span><span>{subtitlePosition}%</span></span>
                            <input className="h-1 w-full accent-white" type="range" min="0" max="100" value={subtitlePosition} onChange={(event) => setSubtitlePosition(Number(event.target.value))} />
                        </label>

                        <label className="block">
                            <span className="mb-2 flex justify-between"><span>Size</span><span>{subtitleSize}%</span></span>
                            <input className="h-1 w-full accent-white" type="range" min="50" max="150" value={subtitleSize} onChange={(event) => setSubtitleSize(Number(event.target.value))} />
                        </label>

                    </div>
                </div>
            )}

            <div
                className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-16 transition-opacity duration-300 md:px-5 md:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:pt-16 ${controlsVisible && !locked ? "opacity-100" : "pointer-events-none opacity-0"}`}
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
                    className="animeverse-player-timeline"
                    style={
                        {
                            "--timeline-progress": `${timelineProgress}%`,
                        } as CSSProperties
                    }
                    aria-label="Seek video"
                />

                <div className="flex items-center gap-2 text-sm text-white/70 md:gap-3">
                    {onPreviousEpisode && (
                        <button
                            type="button"
                            onClick={onPreviousEpisode}
                            className={controlButton}
                            aria-label="Previous episode"
                            title="Previous episode"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => seekBy(-60)}
                        className={`${controlButton} w-auto gap-1 px-2`}
                        aria-label="Rewind 1 minute"
                        title="Rewind 1 minute"
                    >
                        <span className="flex items-center justify-center gap-1">
                            <RotateCcw className="h-6 w-6" />
                            <span className="text-xs font-medium leading-none text-white/80">1m</span>
                        </span>
                    </button>
                    <button type="button" onClick={togglePlay} className={controlButton} aria-label={isPlaying ? "Pause" : "Play"} title={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => seekBy(60)}
                        className={`${controlButton} w-auto gap-1 px-2`}
                        aria-label="Forward 1 minute"
                        title="Forward 1 minute"
                    >
                        <span className="flex items-center justify-center gap-1">
                            <RotateCw className="h-6 w-6" />
                            <span className="text-xs font-medium leading-none text-white/80">1m</span>
                        </span>
                    </button>
                    {onNextEpisode && (
                        <button
                            type="button"
                            onClick={onNextEpisode}
                            className={controlButton}
                            aria-label="Next episode"
                            title="Next episode"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    )}
                    <span className="ml-1 min-w-[5.5rem] font-mono text-xs text-white/70">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    <div className="ml-auto flex items-center gap-1">
                        <div ref={subtitleWrapRef} className="relative hidden sm:block">
                            <button
                                type="button"
                                onClick={() => {
                                    setSubtitleMenuOpen((open) => !open);
                                    setQualityMenuOpen(false);
                                }}
                                className={`${controlButton} ${activeSubtitleIndex !== "off" ? "text-white" : ""}`}
                                aria-label="Subtitles"
                                aria-expanded={subtitleMenuOpen}
                                title="Subtitles"
                            >
                                <Subtitles className="h-5 w-5" />
                            </button>
                            {subtitleMenuOpen && (
                                <div className={popoverClass}>
                                    <button
                                        type="button"
                                        onClick={() => selectSubtitle("off")}
                                        className={popoverItem(activeSubtitleIndex === "off")}
                                    >
                                        <span>Off</span>
                                        {activeSubtitleIndex === "off" && (
                                            <Check className="h-3.5 w-3.5 shrink-0" />
                                        )}
                                    </button>
                                    {subtitles.map((subtitle, index) => (
                                        <button
                                            key={`${subtitle.url}-${index}`}
                                            type="button"
                                            onClick={() => selectSubtitle(index)}
                                            className={popoverItem(activeSubtitleIndex === index)}
                                        >
                                            <span className="truncate">
                                                {subtitle.language || `Track ${index + 1}`}
                                            </span>
                                            {activeSubtitleIndex === index && (
                                                <Check className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                    {subtitles.length === 0 && (
                                        <p className="px-2.5 py-2 text-white/35">
                                            No subtitles for this source
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div ref={qualityWrapRef} className="relative hidden sm:block">
                            <button
                                type="button"
                                disabled={!qualityAvailable}
                                onClick={() => {
                                    setQualityMenuOpen((open) => !open);
                                    setSubtitleMenuOpen(false);
                                }}
                                className={`${controlButton} w-auto px-2 text-[11px] font-bold tracking-wide disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/75`}
                                aria-label="Video quality"
                                aria-expanded={qualityMenuOpen}
                                title={qualityTitle}
                            >
                                {qualityLabel}
                            </button>
                            {qualityMenuOpen && qualityAvailable && (
                                <div className={popoverClass}>
                                    <button
                                        type="button"
                                        onClick={() => changeQuality(-1)}
                                        className={popoverItem(currentLevel < 0)}
                                    >
                                        <span>Auto</span>
                                        {currentLevel < 0 && (
                                            <Check className="h-3.5 w-3.5 shrink-0" />
                                        )}
                                    </button>
                                    {sortedLevels.map((level) => (
                                        <button
                                            key={level.index}
                                            type="button"
                                            onClick={() => changeQuality(level.index)}
                                            className={popoverItem(currentLevel === level.index)}
                                        >
                                            <span>
                                                {formatQuality(level)}
                                            </span>
                                            {currentLevel === level.index && (
                                                <Check className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={toggleAutoNext}
                            aria-pressed={autoNext}
                            title={autoNext ? "Autoplay next episode: on" : "Autoplay next episode: off"}
                            className={`hidden rounded px-2.5 py-1.5 text-[11px] font-bold transition sm:inline-block ${
                                autoNext
                                    ? "bg-white text-black"
                                    : "bg-white/10 text-white/45 hover:bg-white/20 hover:text-white/80"
                            }`}
                        >
                            AUTO
                        </button>

                        <div
                            ref={volumeWrapRef}
                            className="flex items-center"
                            onMouseEnter={() => {
                                if (!isCoarsePointer) setVolumeSliderOpen(true);
                            }}
                            onMouseLeave={() => {
                                if (!isCoarsePointer) setVolumeSliderOpen(false);
                            }}
                        >
                            <button
                                type="button"
                                onClick={handleVolumeButton}
                                className={controlButton}
                                aria-label={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                            </button>
                            <div
                                className={`overflow-hidden transition-[width,opacity] duration-200 ease-out ${
                                    volumeSliderOpen ? "w-24 opacity-100" : "w-0 opacity-0"
                                }`}
                            >
                                <input
                                    className="animeverse-volume-slider ml-1 w-[5.25rem]"
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={(event) => changeVolume(Number(event.target.value))}
                                    aria-label="Volume"
                                    tabIndex={volumeSliderOpen ? 0 : -1}
                                />
                            </div>
                        </div>

                        <button type="button" onClick={requestFullscreen} className={controlButton} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
