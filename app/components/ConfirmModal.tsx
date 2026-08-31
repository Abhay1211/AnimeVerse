"use client";

import type { LucideIcon } from "lucide-react";
import { ShieldAlert, Trash2, X } from "lucide-react";
import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ConfirmModalProps = {
    open: boolean;
    title: string;
    description?: ReactNode;
    /** Emphasised warning strip under the description (e.g. "cannot be undone"). */
    note?: ReactNode;
    confirmLabel: string;
    /** Label shown on the confirm button while the action runs. */
    busyLabel?: string;
    cancelLabel?: string;
    tone?: "danger" | "default";
    icon?: LucideIcon;
    /** Backdrop click dismisses the modal. Default: true. */
    dismissOnBackdrop?: boolean;
    /**
     * Runs on confirm. If it rejects, the modal stays open and shows the error;
     * on success the parent is expected to flip `open` to false.
     */
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
};

const EXIT_MS = 160;

type Phase = "unmounted" | "entering" | "open" | "exiting";

/**
 * Anime Verse confirmation dialog — the in-page replacement for
 * `window.confirm()` / `window.alert()`.
 *
 * Keep it permanently mounted and toggle `open` (so the exit animation can
 * play). Portalled to <body>, focus-trapped, Escape- and backdrop-dismissible
 * (unless busy), and it restores focus to the trigger on close.
 */
export default function ConfirmModal({
    open,
    title,
    description,
    note,
    confirmLabel,
    busyLabel,
    cancelLabel = "Cancel",
    tone = "default",
    icon,
    dismissOnBackdrop = true,
    onConfirm,
    onClose,
}: ConfirmModalProps) {
    // Enter/exit driven by a phase machine advanced with the
    // adjust-state-during-render pattern (no setState inside an effect body).
    const [phase, setPhase] = useState<Phase>(open ? "entering" : "unmounted");
    const [prevOpen, setPrevOpen] = useState(open);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (open !== prevOpen) {
        setPrevOpen(open);
        setPhase(open ? "entering" : "exiting");
        if (open) {
            setBusy(false);
            setError(null);
        }
    }

    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);

    const baseId = useId();
    const titleId = `${baseId}-title`;
    const descId = `${baseId}-desc`;
    const Icon = icon ?? (tone === "danger" ? Trash2 : ShieldAlert);

    const mounted = phase !== "unmounted";

    // Advance the phase machine on timers only.
    useEffect(() => {
        if (phase === "entering") {
            const raf = requestAnimationFrame(() => setPhase("open"));
            return () => cancelAnimationFrame(raf);
        }
        if (phase === "exiting") {
            const timer = window.setTimeout(
                () => setPhase("unmounted"),
                EXIT_MS
            );
            return () => window.clearTimeout(timer);
        }
    }, [phase]);

    // Body scroll lock + initial focus (on the safe Cancel action) + focus
    // restore to the trigger, all scoped to the mounted lifetime.
    useEffect(() => {
        if (!mounted) return;
        const trigger = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const raf = requestAnimationFrame(() => cancelRef.current?.focus());
        return () => {
            document.body.style.overflow = previousOverflow;
            cancelAnimationFrame(raf);
            trigger?.focus?.();
        };
    }, [mounted]);

    const requestClose = useCallback(() => {
        if (busy) return;
        onClose();
    }, [busy, onClose]);

    // Escape to close + a minimal focus trap across the dialog's buttons.
    useEffect(() => {
        if (!mounted) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                requestClose();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
                "button:not([disabled])"
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            } else if (!dialogRef.current.contains(active as Node)) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [mounted, requestClose]);

    const handleConfirm = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await onConfirm();
            // Parent flips `open` → false; the exit transition handles the rest.
        } catch (confirmError) {
            if (process.env.NODE_ENV !== "production") {
                console.error("ConfirmModal action failed:", confirmError);
            }
            setError(
                confirmError instanceof Error && confirmError.message
                    ? confirmError.message
                    : "Something went wrong. Please try again."
            );
            setBusy(false);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div
            className="confirm-backdrop"
            data-visible={phase === "open" ? "true" : "false"}
            onMouseDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    dismissOnBackdrop
                ) {
                    requestClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                className="confirm-modal"
                data-tone={tone}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descId : undefined}
            >
                <button
                    type="button"
                    className="confirm-modal-close"
                    onClick={requestClose}
                    disabled={busy}
                    aria-label="Close"
                >
                    <X size={16} aria-hidden="true" />
                </button>

                <span className="confirm-modal-icon" aria-hidden="true">
                    <Icon size={22} />
                </span>

                <h2 id={titleId}>{title}</h2>

                {description && <p id={descId}>{description}</p>}

                {note && (
                    <div className="confirm-modal-note">
                        <ShieldAlert size={15} aria-hidden="true" />
                        <span>{note}</span>
                    </div>
                )}

                {error && (
                    <p className="confirm-modal-error" role="alert">
                        {error}
                    </p>
                )}

                <div className="confirm-modal-actions">
                    <button
                        ref={cancelRef}
                        type="button"
                        className="confirm-modal-btn is-secondary"
                        onClick={requestClose}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`confirm-modal-btn ${tone === "danger" ? "is-danger" : "is-primary"}`}
                        onClick={handleConfirm}
                        disabled={busy}
                        aria-busy={busy}
                    >
                        {busy ? (
                            busyLabel ?? "Working…"
                        ) : (
                            <>
                                <Icon size={14} aria-hidden="true" />
                                {confirmLabel}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
