"use client";

import {
    ArrowLeft,
    ArrowRight,
    Bell,
    Bookmark,
    Grid2X2,
    Home,
    UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    {
        label: "Home",
        icon: Home,
        href: "/anime",
    },
    {
        label: "Browse",
        icon: Grid2X2,
        href: "/browse",
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
        href: "#",
        disabled: true,
    },
    {
        label: "Saved",
        icon: Bookmark,
        href: "#",
        disabled: true,
    },
];

export default function AnimeNavbar() {
    const pathname = usePathname();

    const goBack = () => window.history.back();
    const goForward = () => window.history.forward();

    return (
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
                    <span>Back</span>
                </button>

                <button
                    type="button"
                    className="anime-nav-item"
                    onClick={goForward}
                    aria-label="Go forward"
                >
                    <ArrowRight size={17} />
                    <span>Next</span>
                </button>
            </div>

            <span className="anime-navbar-divider" />

            <div className="anime-navbar-group">
                {navItems.map((item) => {
                    const Icon = item.icon;

                    if (item.disabled) {
                        return (
                            <button
                                key={item.label}
                                type="button"
                                className="anime-nav-item anime-nav-disabled"
                                disabled
                                aria-label={`${item.label} coming soon`}
                            >
                                <Icon size={17} />
                                <span>{item.label}</span>
                            </button>
                        );
                    }

                    const isActive =
                        pathname === item.href ||
                        (
                            item.href === "/anime" &&
                            pathname.startsWith("/anime/")
                        );

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={`anime-nav-item ${
                                isActive
                                    ? "anime-nav-active"
                                    : ""
                            }`}
                            aria-label={item.label}
                        >
                            <Icon size={17} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}