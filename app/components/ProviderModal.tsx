"use client";

import { useEffect } from "react";

type Provider = {
    id: string;
    name: string;
    description: string;
    meta: string;
    icon: "server" | "cloud" | "layers" | "globe" | "grid";
};

export const PROVIDERS: Provider[] = [
    {
        id: "megaplay",
        name: "MegaPlay",
        description: "Ultra fast · Sub/Dub",
        meta: "Primary · Recommended",
        icon: "server",
    },
    {
        id: "anikoto",
        name: "Anikoto",
        description: "Anikoto API - Sub/Dub",
        meta: "Provider 2 - Sub/Dub",
        icon: "layers",
    },
    {
        id: "vidhawk",
        name: "VidHawk",
        description: "VidHawk embed · Sub/Dub",
        meta: "Provider 3 - Embedded player",
        icon: "globe",
    },
];

type ProviderModalProps = {
    open: boolean;
    selectedProvider: string;
    onSelect: (provider: string) => void;
    onClose: () => void;
    onStart: () => void;
};

function ProviderIcon({
    type,
}: {
    type: Provider["icon"];
}) {
    const common = {
        width: 20,
        height: 20,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };

    if (type === "server") {
        return (
            <svg {...common}>
                <rect x="4" y="3" width="16" height="7" rx="2" />
                <rect x="4" y="14" width="16" height="7" rx="2" />
                <path d="M8 7h.01M8 18h.01" />
            </svg>
        );
    }

    if (type === "cloud") {
        return (
            <svg {...common}>
                <path d="M17.5 19H9a6 6 0 1 1 5.9-7H17.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
        );
    }

    if (type === "layers") {
        return (
            <svg {...common}>
                <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                <path d="m3 12 9 5 9-5" />
                <path d="m3 16 9 5 9-5" />
            </svg>
        );
    }

    if (type === "globe") {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
        );
    }

    return (
        <svg {...common}>
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
    );
}

export default function ProviderModal({
    open,
    selectedProvider,
    onSelect,
    onClose,
    onStart,
}: ProviderModalProps) {
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1.5rem,env(safe-area-inset-top,0px))] backdrop-blur-md"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="provider-modal-title"
                className="relative my-auto max-h-full w-full max-w-[400px] overflow-y-auto rounded-2xl border border-white/10 bg-[#101010] shadow-[0_30px_100px_rgba(0,0,0,0.7)]"
            >
                <div className="p-5">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close provider selector"
                        className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                    </button>

                    <div className="pr-10">
                        <h2
                            id="provider-modal-title"
                            className="font-mono text-xl font-bold tracking-tight text-white"
                        >
                            Choose Provider
                        </h2>

                        <p className="mt-2 font-mono text-[11px] leading-relaxed tracking-wide text-white/40">
                            Select your preferred streaming provider before
                            watching.
                        </p>
                    </div>

                    <div className="mt-5 space-y-2">
                        {PROVIDERS.map((provider, index) => {
                            const selected =
                                selectedProvider === provider.id;

                            return (
                                <button
                                    key={provider.id}
                                    type="button"
                                    onClick={() => onSelect(provider.id)}
                                    className={`group flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-all ${
                                        selected
                                            ? "border-white/80 bg-white/[0.09]"
                                            : "border-white/[0.07] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.05]"
                                    }`}
                                >
                                    <div
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                                            selected
                                                ? "border-white/30 bg-white/10 text-white"
                                                : "border-white/10 bg-white/[0.04] text-white/55 group-hover:text-white/80"
                                        }`}
                                    >
                                        <ProviderIcon
                                            type={provider.icon}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-bold text-white">
                                                {provider.name}
                                            </span>

                                            {index === 0 && (
                                                <span className="rounded-full border border-white/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-white/45">
                                                    Primary
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-1 font-mono text-[10px] text-white/45">
                                            {provider.description}
                                        </p>

                                        <p className="mt-0.5 font-mono text-[9px] text-white/25">
                                            {provider.meta}
                                        </p>
                                    </div>

                                    <div
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                                            selected
                                                ? "border-white bg-white"
                                                : "border-white/20"
                                        }`}
                                    >
                                        {selected && (
                                            <span className="h-2 w-2 rounded-full bg-black" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={onStart}
                        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-mono text-xs font-bold tracking-wide text-black transition hover:bg-white/90 active:scale-[0.99]"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                        Start Watching
                    </button>
                </div>
            </div>
        </div>
    );
}
