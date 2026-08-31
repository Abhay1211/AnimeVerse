"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import AnimeVerseLogo from "../AnimeVerseLogo";
import AnimeNavbar from "../components/AnimeNavbar";
import AuthForm, { type AuthMode } from "./AuthForm";

const COPY: Record<
    AuthMode,
    {
        heading: string;
        subtitle: string;
        prompt: string;
        linkLabel: string;
        linkHref: string;
    }
> = {
    signin: {
        heading: "Welcome Back",
        subtitle: "Sign in to your account",
        prompt: "Don't have an account?",
        linkLabel: "Sign Up",
        linkHref: "/auth?mode=signup",
    },
    signup: {
        heading: "Create Account",
        subtitle: "Join AnimeVerse community",
        prompt: "Already have an account?",
        linkLabel: "Sign In",
        linkHref: "/auth",
    },
};

export default function AuthExperience() {
    const searchParams = useSearchParams();
    const mode: AuthMode =
        searchParams.get("mode") === "signup" ? "signup" : "signin";
    const copy = COPY[mode];

    return (
        <>
            <AnimeNavbar />

            <main className="auth-page">
                <section className="auth-shell">
                    <div className="auth-brand">
                        <AnimeVerseLogo />
                    </div>

                    <header className="auth-head">
                        <span className="auth-eyebrow">
                            {"/// ANIMEVERSE ACCESS"}
                        </span>
                        <h1 className="auth-heading">{copy.heading}</h1>
                        <p className="auth-subtitle">{copy.subtitle}</p>
                    </header>

                    {/* key resets field/error state when switching modes */}
                    <AuthForm key={mode} mode={mode} />

                    <p className="auth-switch">
                        {copy.prompt}{" "}
                        <Link
                            href={copy.linkHref}
                            className="auth-switch-link"
                        >
                            {copy.linkLabel}
                        </Link>
                    </p>
                </section>
            </main>
        </>
    );
}
