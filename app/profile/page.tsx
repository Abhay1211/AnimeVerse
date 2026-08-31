"use client";

import {
    ArrowRight, Bookmark, Clock3, Crown, Heart,
    LayoutDashboard, LogOut, PlayCircle, Settings, UserRound, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";

import { changePassword, signOutUser, updateDisplayName } from "../auth/authActions";
import AnimeNavbar from "../components/AnimeNavbar";
import ConfirmModal from "../components/ConfirmModal";
import { useHomeAnime } from "../components/useHomeAnime";
import { fetchFavorites, type FavoriteAnimeItem } from "../lib/favorites";
import { fetchSavedAnime, type SavedAnimeItem } from "../lib/saved";
import { fetchWatchProgress, removeWatchProgress, type WatchProgressItem } from "../lib/watchProgress";
import { fetchRecentlyViewed, type RecentlyViewedItem } from "../lib/recentlyViewed";
import { useAuthUser } from "../lib/useAuthUser";

type DashboardData = {
    watchProgress: WatchProgressItem[];
    saved: SavedAnimeItem[];
    favorites: FavoriteAnimeItem[];
    recentlyViewed: RecentlyViewedItem[];
};

const EMPTY_DATA: DashboardData = { watchProgress: [], saved: [], favorites: [], recentlyViewed: [] };

// In-page dashboard sections. The sidebar scrolls between these on /profile
// rather than routing away to /library, /recently-viewed, etc.
const SECTIONS = [
    { id: "overview", label: "OVERVIEW", icon: LayoutDashboard },
    { id: "my-list", label: "MY LIST", icon: Bookmark },
    { id: "continue-watching", label: "CONTINUE WATCHING", icon: PlayCircle },
    { id: "recent-activity", label: "RECENT ACTIVITY", icon: Clock3 },
    { id: "account", label: "ACCOUNT", icon: UserRound },
    { id: "settings", label: "SETTINGS", icon: Settings },
] as const;
// Index of the first "account" group item — a divider is drawn before it.
const ACCOUNT_GROUP_START = SECTIONS.findIndex((section) => section.id === "account");

const MAX_NAME_LENGTH = 40;
const MIN_PASSWORD_LENGTH = 6;

function initialsFor(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "").join("") || "AV";
}

function relativeTime(timestamp: number | null): string {
    if (!timestamp) return "RECENTLY";
    const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
    if (minutes < 1) return "JUST NOW";
    if (minutes < 60) return `${minutes}M AGO`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}H AGO`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "YESTERDAY" : `${days}D AGO`;
}

// Smooth-scroll to an in-page dashboard section (respects reduced motion) and
// sync the hash. Client-only; called from click handlers. The Intersection
// observer below updates the active sidebar item as the scroll lands.
function smoothScrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
}

function SectionHeading({ icon: Icon, title, targetId, href }: {
    icon: typeof Bookmark;
    title: string;
    /** In-page section to scroll to (preferred — keeps the user on /profile). */
    targetId?: string;
    /** Fallback external destination when there is no in-page section. */
    href?: string;
}) {
    return (
        <div className="profile-section-heading">
            <h2><Icon size={17} aria-hidden="true" />{title}</h2>
            {targetId ? (
                <button type="button" className="profile-view-all" onClick={() => smoothScrollToSection(targetId)}>
                    VIEW ALL <ArrowRight size={14} />
                </button>
            ) : href ? (
                <Link href={href} className="profile-view-all">VIEW ALL <ArrowRight size={14} /></Link>
            ) : null}
        </div>
    );
}

function LibraryRow({ item, addedAt }: {
    item: SavedAnimeItem | FavoriteAnimeItem;
    addedAt: number | null;
}) {
    return (
        <Link href={`/anime/${encodeURIComponent(item.animeId)}`} className="profile-library-row">
            {item.poster
                ? <img src={item.poster} alt="" loading="lazy" decoding="async" className="profile-library-poster" />
                : <div className="profile-library-poster profile-library-poster-empty" />}
            <span className="profile-library-copy">
                <strong>{item.title}</strong>
                <small>ADDED {relativeTime(addedAt)}</small>
            </span>
            <ArrowRight size={14} aria-hidden="true" />
        </Link>
    );
}

function EmptyPanel({ children }: { children: ReactNode }) {
    return <p className="profile-panel-empty">{children}</p>;
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuthUser();
    const [loggingOut, setLoggingOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DashboardData>(EMPTY_DATA);
    const [dataLoading, setDataLoading] = useState(true);
    const [pendingRemoval, setPendingRemoval] = useState<WatchProgressItem | null>(null);
    // Held separately so the modal keeps its text through the exit animation.
    const [removalTitle, setRemovalTitle] = useState("");
    const { heroAnime } = useHomeAnime();

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace("/auth");
            return;
        }
        let cancelled = false;
        Promise.all([
            fetchWatchProgress(user.uid), fetchSavedAnime(user.uid),
            fetchFavorites(user.uid), fetchRecentlyViewed(user.uid),
        ]).then(([watchProgress, saved, favorites, recentlyViewed]) => {
            if (!cancelled) {
                setData({ watchProgress, saved, favorites, recentlyViewed });
                setDataLoading(false);
            }
        }).catch((loadError) => {
            if (cancelled) return;
            if (process.env.NODE_ENV !== "production") console.error("Failed to load profile dashboard:", loadError);
            setError("Couldn’t load some account data. Please try again later.");
            setDataLoading(false);
        });
        return () => { cancelled = true; };
    }, [authLoading, router, user]);

    // --- In-page section navigation -------------------------------------
    const [activeSection, setActiveSection] = useState<string>("overview");

    const scrollToSection = (id: string) => {
        smoothScrollToSection(id);
        setActiveSection(id);
    };

    // Highlight the sidebar item for whichever section is currently in view.
    // Re-runs once data loads because section heights change.
    useEffect(() => {
        const els = SECTIONS
            .map((section) => document.getElementById(section.id))
            .filter((el): el is HTMLElement => el !== null);
        if (els.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const top = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (top) setActiveSection(top.target.id);
            },
            { rootMargin: "-15% 0px -75% 0px" }
        );
        els.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [dataLoading]);

    const displayName = user?.displayName?.trim() || "AnimeVerse User";
    const email = user?.email?.trim() || "No email on file";
    const initials = useMemo(() => initialsFor(displayName), [displayName]);
    const signInMethod = useMemo(
        () => user?.providerData
            .map((provider) => provider.providerId === "password" ? "Email / Password" : provider.providerId)
            .join(", ") || "Unknown",
        [user]
    );
    const canChangePassword = useMemo(
        () => Boolean(user?.providerData.some((provider) => provider.providerId === "password")),
        [user]
    );
    // Firebase Auth exposes the account creation time client-side — no extra read.
    const memberSince = useMemo(() => {
        const created = user?.metadata.creationTime;
        if (!created) return null;
        const date = new Date(created);
        return Number.isNaN(date.getTime())
            ? null
            : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }, [user]);

    // High-resolution TMDB backdrop (w1280) for whichever anime currently tops
    // the airing schedule — the same artwork the /anime hero uses. Stable per
    // page load; the CSS ::after gradient keeps the copy readable. Falls back to
    // the plain dark hero background when no backdrop is available.
    const heroBanner = useMemo(
        () => heroAnime.find((anime) => anime.banner)?.banner ?? null,
        [heroAnime]
    );

    // --- Account section: edit display name -------------------------------
    // Draft tracks the *raw* Firebase displayName (not the "AnimeVerse User"
    // display fallback) so an unset name starts blank. Re-syncs via the
    // adjust-state-during-render pattern whenever the stored name changes.
    const storedName = user?.displayName ?? "";
    const [nameDraft, setNameDraft] = useState(storedName);
    const [nameSynced, setNameSynced] = useState(storedName);
    if (nameSynced !== storedName) {
        setNameSynced(storedName);
        setNameDraft(storedName);
    }
    const [savingName, setSavingName] = useState(false);
    const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const trimmedName = nameDraft.trim();
    const nameError =
        trimmedName.length === 0
            ? "Display name is required."
            : trimmedName.length > MAX_NAME_LENGTH
              ? `Keep it under ${MAX_NAME_LENGTH} characters.`
              : null;
    const nameDirty = trimmedName !== storedName.trim();

    const handleSaveProfile = async (event: React.FormEvent) => {
        event.preventDefault();
        if (savingName || nameError || !nameDirty) return;
        setSavingName(true);
        setNameMsg(null);
        const result = await updateDisplayName(trimmedName);
        setSavingName(false);
        setNameMsg(
            result.status === "ok"
                ? { ok: true, text: "Profile updated." }
                : { ok: false, text: result.message }
        );
    };

    // --- Account section: change password ---------------------------------
    const [pwCurrent, setPwCurrent] = useState("");
    const [pwNext, setPwNext] = useState("");
    const [pwConfirm, setPwConfirm] = useState("");
    const [savingPw, setSavingPw] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const pwError =
        pwNext.length > 0 && pwNext.length < MIN_PASSWORD_LENGTH
            ? `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
            : pwConfirm.length > 0 && pwNext !== pwConfirm
              ? "New passwords don’t match."
              : pwNext.length > 0 && pwNext === pwCurrent
                ? "New password must be different from the current one."
                : null;
    const pwReady =
        pwCurrent.length > 0 &&
        pwNext.length >= MIN_PASSWORD_LENGTH &&
        pwNext === pwConfirm &&
        pwNext !== pwCurrent;

    const handleChangePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        if (savingPw || !pwReady) return;
        setSavingPw(true);
        setPwMsg(null);
        const result = await changePassword(pwCurrent, pwNext);
        setSavingPw(false);
        if (result.status === "ok") {
            setPwCurrent(""); setPwNext(""); setPwConfirm("");
            setPwMsg({ ok: true, text: "Password updated." });
        } else {
            setPwMsg({ ok: false, text: result.message });
        }
    };

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true); setError(null);
        const result = await signOutUser();
        if (result.status === "ok") { router.replace("/auth"); return; }
        setLoggingOut(false); setError(result.message);
    };

    const confirmRemoveProgress = async () => {
        const item = pendingRemoval;
        if (!user || !item) return;
        try {
            await removeWatchProgress(user.uid, item.animeId);
        } catch (removeError) {
            if (process.env.NODE_ENV !== "production") console.error("Failed to remove profile watch progress:", removeError);
            throw new Error("Couldn’t remove this item. Please try again.");
        }
        setData((current) => ({
            ...current,
            watchProgress: current.watchProgress.filter((entry) => entry.animeId !== item.animeId),
        }));
        setPendingRemoval(null);
    };

    if (authLoading || !user) {
        return <><AnimeNavbar /><main className="profile-dashboard-page"><div className="anime-browse-loading">{authLoading ? "LOADING…" : "REDIRECTING…"}</div></main></>;
    }

    return (
        <>
            <AnimeNavbar />
            <main className="profile-dashboard-page">
                <aside className="profile-sidebar" aria-label="Profile dashboard navigation">
                    <div className="profile-sidebar-identity">
                        <div className="profile-avatar-wrap">
                            {user.photoURL
                                ? <img src={user.photoURL} alt="" className="profile-avatar" />
                                : <div className="profile-avatar profile-avatar-fallback" aria-hidden="true">{initials}</div>}
                        </div>
                        <div className="profile-sidebar-user"><strong>{displayName}</strong><span>{email}</span><small>{signInMethod}</small></div>
                    </div>

                    <nav className="profile-sidebar-nav" aria-label="Profile sections">
                        {SECTIONS.map((section, index) => {
                            const Icon = section.icon;
                            return (
                                <Fragment key={section.id}>
                                    {index === ACCOUNT_GROUP_START && <span className="profile-sidebar-divider" />}
                                    <a
                                        href={`#${section.id}`}
                                        className={activeSection === section.id ? "is-active" : ""}
                                        aria-current={activeSection === section.id ? "true" : undefined}
                                        onClick={(event) => { event.preventDefault(); scrollToSection(section.id); }}
                                    >
                                        <Icon size={16} /> {section.label}
                                    </a>
                                </Fragment>
                            );
                        })}
                        <button type="button" onClick={handleLogout} disabled={loggingOut}><LogOut size={16} /> {loggingOut ? "SIGNING OUT…" : "SIGN OUT"}</button>
                    </nav>

                    <span className="profile-sidebar-divider profile-sidebar-divider-foot" />
                    <div className="profile-premium-card">
                        <Crown size={20} />
                        <strong>ANIMEVERSE PREMIUM</strong>
                        <p>Unlock exclusive features and support AnimeVerse.</p>
                        <button type="button" disabled title="AnimeVerse Premium is coming soon">COMING SOON</button>
                    </div>
                </aside>

                <section className="profile-dashboard-main">
                    <section id="overview" className="profile-dashboard-hero" aria-label="AnimeVerse overview">
                        <div className="profile-dashboard-hero-art is-ready" aria-hidden="true">
                            {heroBanner && (
                                <div
                                    className="profile-dashboard-hero-image is-active"
                                    style={{ backgroundImage: `url("${heroBanner}")` }}
                                />
                            )}
                        </div>
                        <div className="profile-dashboard-hero-content">
                            <header className="profile-dashboard-hero-header"><span className="anime-browse-label">{"/// YOUR ANIME HUB"}</span><h1>WELCOME BACK, {displayName.toUpperCase()}! <span aria-hidden="true">👋</span></h1><p>Track, manage and continue your anime journey.</p></header>
                            <div className="profile-stat-grid profile-hero-stats">
                                <div className="profile-stat-card"><PlayCircle size={19} /><strong>{data.watchProgress.length}</strong><span>IN PROGRESS</span></div>
                                <div className="profile-stat-card"><Bookmark size={19} /><strong>{data.saved.length}</strong><span>SAVED</span></div>
                                <div className="profile-stat-card"><Heart size={19} /><strong>{data.favorites.length}</strong><span>FAVORITES</span></div>
                                <div className="profile-stat-card"><Clock3 size={19} /><strong>{data.recentlyViewed.length}</strong><span>VIEWED</span></div>
                            </div>
                        </div>
                    </section>

                    {error && <p className="profile-dashboard-error" role="alert">{error}</p>}

                    <section id="continue-watching" className="profile-dashboard-panel profile-continue-panel">
                        <SectionHeading icon={PlayCircle} title="CONTINUE WATCHING" targetId="continue-watching" />
                        {dataLoading ? <div className="profile-panel-loading">LOADING…</div> : data.watchProgress.length === 0 ? <EmptyPanel>No watch progress yet. <Link href="/anime" className="profile-panel-inline-link">Browse anime →</Link></EmptyPanel> : <div className="profile-continue-list">{data.watchProgress.slice(0, 4).map((item) => { const percent = item.duration && item.duration > 0 && item.currentTime !== null ? Math.min(100, Math.max(0, Math.round((item.currentTime / item.duration) * 100))) : 0; return <div key={item.animeId} className="profile-continue-item"><Link href={`/anime/${encodeURIComponent(item.animeId)}/watch?episode=${item.episode}&type=sub&provider=megaplay`} className="profile-continue-card">{item.poster ? <img src={item.poster} alt="" loading="lazy" decoding="async" /> : <div className="profile-continue-poster-empty" />}<span className="profile-continue-copy"><strong>{item.title}</strong><span>Episode {item.episode}</span><span className="profile-continue-progress"><span style={{ width: `${percent}%` }} /></span><small>{percent}% watched · {relativeTime(item.updatedAt)}</small></span><span className="profile-continue-arrow"><PlayCircle size={16} /></span></Link><button type="button" onClick={() => { setPendingRemoval(item); setRemovalTitle(item.title); }} disabled={pendingRemoval !== null} className="profile-continue-remove" aria-label={`Remove ${item.title} from Continue Watching`} title="Remove from Continue Watching"><X size={14} /></button></div>; })}</div>}
                    </section>

                    <div className="profile-lower-grid">
                        <section id="my-list" className="profile-dashboard-panel"><SectionHeading icon={Bookmark} title="MY LIST" targetId="my-list" />{dataLoading ? <div className="profile-panel-loading">LOADING…</div> : data.saved.length === 0 ? <EmptyPanel>No saved anime yet.</EmptyPanel> : <div className="profile-library-list">{data.saved.slice(0, 4).map((item) => <LibraryRow key={item.animeId} item={item} addedAt={item.savedAt} />)}</div>}<Link href="/library" className="profile-panel-action">OPEN FULL LIBRARY <ArrowRight size={14} /></Link></section>
                        <section className="profile-dashboard-panel"><SectionHeading icon={Heart} title="FAVORITES" href="/library" />{dataLoading ? <div className="profile-panel-loading">LOADING…</div> : data.favorites.length === 0 ? <EmptyPanel>No favorites yet.</EmptyPanel> : <div className="profile-library-list">{data.favorites.slice(0, 4).map((item) => <LibraryRow key={item.animeId} item={item} addedAt={item.favoritedAt} />)}</div>}<Link href="/library" className="profile-panel-action">OPEN FULL LIBRARY <ArrowRight size={14} /></Link></section>
                        <section id="recent-activity" className="profile-dashboard-panel"><SectionHeading icon={Clock3} title="RECENT ACTIVITY" targetId="recent-activity" />{dataLoading ? <div className="profile-panel-loading">LOADING…</div> : data.recentlyViewed.length === 0 ? <EmptyPanel>No recent activity yet.</EmptyPanel> : <div className="profile-activity-list">{data.recentlyViewed.slice(0, 5).map((item) => <Link key={item.animeId} href={`/anime/${encodeURIComponent(item.animeId)}`} className="profile-activity-row">{item.poster ? <img src={item.poster} alt="" loading="lazy" decoding="async" /> : <div />}<span><strong>{item.title}</strong><small>VIEWED ANIME</small></span><time>{relativeTime(item.watchedAt)}</time></Link>)}</div>}<Link href="/recently-viewed" className="profile-panel-action">OPEN FULL HISTORY <ArrowRight size={14} /></Link></section>
                    </div>

                    <section id="account" className="profile-dashboard-panel profile-account-panel">
                        <div className="profile-section-heading"><h2><UserRound size={17} aria-hidden="true" />ACCOUNT</h2></div>

                        <dl className="profile-account-info">
                            <div><dt>USERNAME</dt><dd>{displayName}</dd></div>
                            <div><dt>EMAIL</dt><dd>{email}</dd></div>
                            <div><dt>SIGN-IN METHOD</dt><dd>{signInMethod}</dd></div>
                            {memberSince && <div><dt>MEMBER SINCE</dt><dd>{memberSince}</dd></div>}
                        </dl>

                        <form className="profile-account-form" onSubmit={handleSaveProfile} noValidate>
                            <h3>EDIT PROFILE</h3>
                            <label htmlFor="profile-username">USERNAME</label>
                            <input
                                id="profile-username"
                                type="text"
                                className="profile-account-input font-mono"
                                value={nameDraft}
                                maxLength={MAX_NAME_LENGTH + 10}
                                autoComplete="nickname"
                                spellCheck={false}
                                onChange={(event) => { setNameDraft(event.target.value); setNameMsg(null); }}
                            />
                            {nameError && nameDirty && <p className="profile-form-msg is-error">{nameError}</p>}
                            {nameMsg && <p className={`profile-form-msg ${nameMsg.ok ? "is-ok" : "is-error"}`} role="status">{nameMsg.text}</p>}
                            <button type="submit" className="profile-account-submit font-mono" disabled={savingName || !nameDirty || Boolean(nameError)} aria-busy={savingName}>
                                {savingName ? "SAVING…" : "SAVE CHANGES"}
                            </button>
                        </form>

                        {canChangePassword ? (
                            <form className="profile-account-form" onSubmit={handleChangePassword} noValidate>
                                <h3>CHANGE PASSWORD</h3>
                                <label htmlFor="profile-pw-current">CURRENT PASSWORD</label>
                                <input id="profile-pw-current" type="password" className="profile-account-input font-mono" value={pwCurrent} autoComplete="current-password" onChange={(event) => { setPwCurrent(event.target.value); setPwMsg(null); }} />
                                <label htmlFor="profile-pw-new">NEW PASSWORD</label>
                                <input id="profile-pw-new" type="password" className="profile-account-input font-mono" value={pwNext} autoComplete="new-password" onChange={(event) => { setPwNext(event.target.value); setPwMsg(null); }} />
                                <label htmlFor="profile-pw-confirm">CONFIRM NEW PASSWORD</label>
                                <input id="profile-pw-confirm" type="password" className="profile-account-input font-mono" value={pwConfirm} autoComplete="new-password" onChange={(event) => { setPwConfirm(event.target.value); setPwMsg(null); }} />
                                {pwError && <p className="profile-form-msg is-error">{pwError}</p>}
                                {pwMsg && <p className={`profile-form-msg ${pwMsg.ok ? "is-ok" : "is-error"}`} role="status">{pwMsg.text}</p>}
                                <button type="submit" className="profile-account-submit font-mono" disabled={savingPw || !pwReady} aria-busy={savingPw}>
                                    {savingPw ? "UPDATING…" : "UPDATE PASSWORD"}
                                </button>
                            </form>
                        ) : (
                            <p className="profile-account-note">Password changes are managed by your sign-in provider ({signInMethod}).</p>
                        )}
                    </section>

                    <section id="settings" className="profile-dashboard-panel profile-settings-panel">
                        <div className="profile-section-heading"><h2><Settings size={17} aria-hidden="true" />SETTINGS</h2></div>
                        <p className="profile-settings-note">Playback and display preferences are coming in a future update. Your display name and password are managed under Account.</p>
                        <button type="button" className="profile-settings-signout font-mono" onClick={handleLogout} disabled={loggingOut}>
                            <LogOut size={14} aria-hidden="true" /> {loggingOut ? "SIGNING OUT…" : "SIGN OUT"}
                        </button>
                    </section>
                </section>
            </main>

            <ConfirmModal
                open={pendingRemoval !== null}
                tone="danger"
                title="Remove from Continue Watching?"
                description={`${removalTitle ? `"${removalTitle}"` : "This title"} will be removed from Continue Watching. Your saved and favorite lists aren't affected.`}
                confirmLabel="Remove"
                busyLabel="Removing…"
                onConfirm={confirmRemoveProgress}
                onClose={() => setPendingRemoval(null)}
            />
        </>
    );
}
