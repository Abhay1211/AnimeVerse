"use client";

import {
    ArrowLeft,
    ArrowRight,
    Bell,
    Bookmark,
    Eye,
    Grid2X2,
    Home,
    UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useRef, useState } from "react";

import { useAuthUser } from "../lib/useAuthUser";
import AccountMenu from "./AccountMenu";

const navItems = [
    {
        label: "Home",
        icon: Home,
        href: "/anime",
    },
    {
        label: "Explore",
        icon: Grid2X2,
        href: "/explore",
    },
    {
        label: "Alerts",
        icon: Bell,
        href: "#",
        disabled: true,
    },
    {
        label: "Profile",
        icon: UserRound,
        href: "/profile",
        disabled: true,
        // Signed out -> /auth. Signed in -> /profile. Resolved at render time
        // from the shared auth state.
        auth: true,
    },
    {
        label: "List",
        icon: Bookmark,
        href: "/library",
    },
    {
        label: "Recent",
        icon: Eye,
        href: "/recently-viewed",
    },
];

export default function AnimeNavbar() {
    const pathname = usePathname();
    const { user, loading: authLoading } = useAuthUser();

    const [menuOpen, setMenuOpen] = useState(false);
    const profileBtnRef = useRef<HTMLButtonElement>(null);

    // Render-phase reset (the pattern AnimeSearch uses): close the account menu
    // whenever the route changes or the user signs out — no effect needed.
    const menuKey = `${pathname}|${user ? user.uid : "none"}`;
    const [trackedMenuKey, setTrackedMenuKey] = useState(menuKey);
    if (menuKey !== trackedMenuKey) {
        setTrackedMenuKey(menuKey);
        if (menuOpen) setMenuOpen(false);
    }

    const goBack = () => window.history.back();
    const goForward = () => window.history.forward();

    return (
        <>
        <nav
            className="anime-navbar"
            aria-label="AnimeVerse navigation"
        >
            <div className="anime-navbar-group anime-navbar-history">
                <button
                    type="button"
                    className="anime-nav-item"
                    onClick={goBack}
                    aria-label="Go back"
                >
                    <ArrowLeft size={17} />
                </button>

                <button
                    type="button"
                    className="anime-nav-item"
                    onClick={goForward}
                    aria-label="Go forward"
                >
                    <ArrowRight size={17} />
                </button>
            </div>

            <span className="anime-navbar-divider" />

            <div className="anime-navbar-group">
                {navItems.map((item, index) => {
                    const Icon = item.icon;

                    const groupDivider =
                        index === 3 ? (
                            <span
                                className="anime-navbar-divider"
                                aria-hidden="true"
                            />
                        ) : null;

                    // Signed-in Profile item navigates to the account page.
                    if ("auth" in item && !authLoading && user) {
                        return (
                            <Fragment key={item.label}>
                                {groupDivider}
                                <Link
                                    href="/profile"
                                    className={`anime-nav-item ${
                                        pathname === "/profile"
                                            ? "anime-nav-active"
                                            : ""
                                    }`}
                                    aria-label={item.label}
                                >
                                    <Icon size={17} />
                                </Link>
                            </Fragment>
                        );
                    }

                    // Signed-out "auth" item becomes a live link to /auth; while
                    // auth state is still loading it keeps its neutral disabled
                    // ("coming soon") state — no signed-in/out flash.
                    const isAuthEntry =
                        "auth" in item && !authLoading && !user;
                    const href = isAuthEntry ? "/auth" : item.href;

                    if (item.disabled && !isAuthEntry) {
                        return (
                            <Fragment key={item.label}>
                                {groupDivider}
                                <button
                                    type="button"
                                    className="anime-nav-item anime-nav-disabled"
                                    disabled
                                    aria-label={`${item.label} coming soon`}
                                >
                                    <Icon size={17} />
                                </button>
                            </Fragment>
                        );
                    }

                    const isActive =
                        pathname === href ||
                        (
                            href === "/anime" &&
                            pathname.startsWith("/anime/")
                        );

                    return (
                        <Fragment key={item.label}>
                            {groupDivider}
                            <Link
                                href={href}
                                className={`anime-nav-item ${
                                    isActive
                                        ? "anime-nav-active"
                                        : ""
                                }`}
                                aria-label={item.label}
                            >
                                <Icon size={17} />
                            </Link>
                        </Fragment>
                    );
                })}
            </div>
        </nav>

        {menuOpen && user && (
            <AccountMenu
                user={user}
                anchorRef={profileBtnRef}
                onClose={() => setMenuOpen(false)}
            />
        )}
        </>
    );
}
