"use client";

import { LogOut } from "lucide-react";
import type { User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";

import { signOutUser } from "../auth/authActions";

interface AccountMenuProps {
    user: User;
    /** The signed-in Profile navbar button this popover is anchored to. */
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

/**
 * Small account popover for a signed-in user: display name, email, LOG OUT.
 *
 * Rendered as a sibling of <nav class="anime-navbar"> (never a descendant) so
 * it is not clipped by the navbar's `overflow: hidden`; positioned with
 * `position: fixed` from the anchor button's rect, opening upward. Reads the
 * Firebase Auth user directly — no Firestore request.
 */
export default function AccountMenu({
    user,
    anchorRef,
    onClose,
}: AccountMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    const [pos, setPos] = useState<{ bottom: number; right: number } | null>(
        null
    );
    const [loggingOut, setLoggingOut] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const displayName = user.displayName?.trim() || "AnimeVerse User";
    const email = user.email?.trim() || "No email on file";

    // Pin the popover above the anchored navbar item, opening upward. The navbar
    // is `position: fixed`, so the anchor only moves on resize.
    useEffect(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;

        const place = () => {
            const rect = anchor.getBoundingClientRect();
            setPos({
                bottom: window.innerHeight - rect.top + 10,
                right: Math.max(12, window.innerWidth - rect.right),
            });
        };

        const raf = requestAnimationFrame(place);
        window.addEventListener("resize", place);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", place);
        };
    }, [anchorRef]);

    const style: React.CSSProperties = pos
        ? { bottom: pos.bottom, right: pos.right }
        : { visibility: "hidden" };

    // Close on outside pointer / Escape.
    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (anchorRef.current?.contains(target)) return; // toggle handles itself
            onClose();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
                anchorRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [anchorRef, onClose]);

    // Move focus into the menu when it opens.
    useEffect(() => {
        menuRef.current?.focus();
    }, []);

    const handleLogout = async () => {
        if (loggingOut) return;

        setLoggingOut(true);
        setError(null);

        const result = await signOutUser();

        if (result.status === "ok") {
            // useAuthUser()'s listener flips the shared user to null, the parent
            // unmounts this menu, and Profile reverts to its /auth link.
            onClose();
            return;
        }

        setLoggingOut(false);
        setError(result.message);
    };

    return (
        <div
            ref={menuRef}
            className="account-menu"
            role="menu"
            aria-label="Account"
            tabIndex={-1}
            style={style}
        >
            <span className="account-menu-label">Profile</span>

            <div className="account-menu-identity">
                <span className="account-menu-name">{displayName}</span>
                <span className="account-menu-email">{email}</span>
            </div>

            {error && (
                <p className="account-menu-error" role="alert">
                    {error}
                </p>
            )}

            <button
                type="button"
                role="menuitem"
                className="account-menu-logout font-mono"
                onClick={handleLogout}
                disabled={loggingOut}
            >
                <LogOut size={13} aria-hidden="true" />
                {loggingOut ? "LOGGING OUT…" : "LOG OUT"}
            </button>
        </div>
    );
}
