/**
 * "Recently Viewed" data helper.
 *
 * Firestore layout:  users/{uid}/recentlyViewed/{animeId}
 *   { animeId: string, title: string, poster: string, watchedAt: Timestamp }
 *
 * "Recently viewed" = the user opened the anime's detail page. It is NOT watch
 * history / continue watching and stores no episode, provider, or playback data.
 *
 * Both functions are browser-only (they use the lazy `getFirebaseAuth()` /
 * `getFirebaseDb()` from `./firebase`). Recording is fire-and-forget and never
 * throws; reading may throw and the caller handles it as a soft error.
 */

import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
} from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "./firebase";

/** How many entries the Recently Viewed page loads. */
const MAX_RESULTS = 60;

export interface RecentlyViewedInput {
    animeId: string;
    title: string;
    poster: string;
}

export interface RecentlyViewedItem extends RecentlyViewedInput {
    /** Epoch ms, or null while the server timestamp is still resolving. */
    watchedAt: number | null;
}

/**
 * Upsert `users/{uid}/recentlyViewed/{animeId}` for the current user, bumping
 * `watchedAt`. No-op when signed out. Never rejects — failures are swallowed
 * (logged only in development) so the anime page is never affected.
 */
export async function recordRecentlyViewed(
    entry: RecentlyViewedInput
): Promise<void> {
    try {
        const user = getFirebaseAuth().currentUser;
        if (!user || !entry.animeId) return;

        await setDoc(
            doc(
                getFirebaseDb(),
                "users",
                user.uid,
                "recentlyViewed",
                entry.animeId
            ),
            {
                animeId: entry.animeId,
                title: entry.title,
                poster: entry.poster,
                watchedAt: serverTimestamp(),
            },
            { merge: true }
        );
    } catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.error("recordRecentlyViewed failed:", error);
        }
    }
}

/**
 * Load a user's recently viewed anime, newest first. Ordered by `watchedAt`
 * descending — a single-field order, so no composite index is required.
 */
export async function fetchRecentlyViewed(
    uid: string
): Promise<RecentlyViewedItem[]> {
    const snapshot = await getDocs(
        query(
            collection(getFirebaseDb(), "users", uid, "recentlyViewed"),
            orderBy("watchedAt", "desc"),
            limit(MAX_RESULTS)
        )
    );

    return snapshot.docs.map((entry) => {
        const data = entry.data();
        const watchedAt = data.watchedAt;

        return {
            animeId:
                typeof data.animeId === "string" ? data.animeId : entry.id,
            title: typeof data.title === "string" ? data.title : "Untitled",
            poster: typeof data.poster === "string" ? data.poster : "",
            watchedAt:
                watchedAt instanceof Timestamp ? watchedAt.toMillis() : null,
        };
    });
}

/**
 * Delete every "recently viewed" record for the current user ("Clear All" on
 * the Recently Viewed page). No-op when signed out. Requires the owner-delete
 * rule on `users/{uid}/recentlyViewed/{animeId}`.
 */
export async function clearRecentlyViewed(uid: string): Promise<void> {
    if (getFirebaseAuth().currentUser?.uid !== uid) return;

    try {
        const snapshot = await getDocs(
            collection(getFirebaseDb(), "users", uid, "recentlyViewed")
        );

        await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
    } catch (error) {
        // Log the real Firebase reason before the caller replaces it with a
        // user-friendly message. A `permission-denied` code here almost always
        // means the deployed Firestore rules for
        // users/{uid}/recentlyViewed/{animeId} are missing `allow delete`
        // (run `firebase deploy --only firestore:rules`).
        const code =
            typeof error === "object" && error !== null && "code" in error
                ? (error as { code?: unknown }).code
                : undefined;
        console.error(
            `clearRecentlyViewed failed for users/${uid}/recentlyViewed`,
            code ? `(code: ${String(code)})` : "",
            error
        );
        throw error;
    }
}
