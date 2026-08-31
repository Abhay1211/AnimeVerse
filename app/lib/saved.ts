/**
 * Saved / Watchlist data helper.
 *
 * Firestore layout: users/{uid}/saved/{animeId}
 *   { animeId: string, title: string, poster: string, savedAt: Timestamp,
 *     status?: "watching" | "plan" | "on_hold" | "completed" | "dropped" }
 *
 * `status` is the unified Library shelf. It is optional and backwards
 * compatible: a doc written before this field (or by the anime-detail "Save"
 * button, which never sets it) is treated as "plan". The Library page is the
 * only writer of `status`, via `setLibraryStatus`.
 */

import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
} from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "./firebase";

const MAX_RESULTS = 60;

export type LibraryStatus =
    | "watching"
    | "plan"
    | "on_hold"
    | "completed"
    | "dropped";

export const LIBRARY_STATUSES: LibraryStatus[] = [
    "watching",
    "plan",
    "on_hold",
    "completed",
    "dropped",
];

function toLibraryStatus(value: unknown): LibraryStatus | null {
    return typeof value === "string" &&
        (LIBRARY_STATUSES as string[]).includes(value)
        ? (value as LibraryStatus)
        : null;
}

export interface SavedAnimeInput {
    animeId: string;
    title: string;
    poster: string;
}

export interface SavedAnimeItem extends SavedAnimeInput {
    /** Epoch ms, or null while the server timestamp is still resolving. */
    savedAt: number | null;
    /** Explicit Library shelf; null when never set (treated as "plan"). */
    status: LibraryStatus | null;
}

function savedDoc(uid: string, animeId: string) {
    return doc(getFirebaseDb(), "users", uid, "saved", animeId);
}

function isCurrentUser(uid: string): boolean {
    return getFirebaseAuth().currentUser?.uid === uid;
}

export async function saveAnime(
    uid: string,
    entry: SavedAnimeInput
): Promise<void> {
    if (!entry.animeId || !isCurrentUser(uid)) return;

    await setDoc(
        savedDoc(uid, entry.animeId),
        {
            animeId: entry.animeId,
            title: entry.title,
            poster: entry.poster,
            savedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

export async function unsaveAnime(
    uid: string,
    animeId: string
): Promise<void> {
    if (!animeId || !isCurrentUser(uid)) return;
    await deleteDoc(savedDoc(uid, animeId));
}

/**
 * Set (or change) an anime's Library shelf. Upserts the `saved` doc so marking
 * a status on an anime that was only in Favorites / watch progress adds it to
 * the list. Writes just `status` (+ identity on first create); `savedAt` is
 * only stamped when the doc does not exist yet.
 */
export async function setLibraryStatus(
    uid: string,
    entry: SavedAnimeInput,
    status: LibraryStatus
): Promise<void> {
    if (!entry.animeId || !isCurrentUser(uid)) return;
    if (!(LIBRARY_STATUSES as string[]).includes(status)) return;

    const ref = savedDoc(uid, entry.animeId);
    const existing = await getDoc(ref);

    await setDoc(
        ref,
        existing.exists()
            ? { status }
            : {
                  animeId: entry.animeId,
                  title: entry.title,
                  poster: entry.poster,
                  status,
                  savedAt: serverTimestamp(),
              },
        { merge: true }
    );
}

export async function isAnimeSaved(
    uid: string,
    animeId: string
): Promise<boolean> {
    if (!animeId || !isCurrentUser(uid)) return false;
    const snapshot = await getDoc(savedDoc(uid, animeId));
    return snapshot.exists();
}

export async function fetchSavedAnime(
    uid: string
): Promise<SavedAnimeItem[]> {
    if (!isCurrentUser(uid)) return [];

    const snapshot = await getDocs(
        query(
            collection(getFirebaseDb(), "users", uid, "saved"),
            orderBy("savedAt", "desc"),
            limit(MAX_RESULTS)
        )
    );

    return snapshot.docs.map((entry) => {
        const data = entry.data();
        const savedAt = data.savedAt;

        return {
            animeId:
                typeof data.animeId === "string" ? data.animeId : entry.id,
            title: typeof data.title === "string" ? data.title : "Untitled",
            poster: typeof data.poster === "string" ? data.poster : "",
            savedAt:
                savedAt instanceof Timestamp ? savedAt.toMillis() : null,
            status: toLibraryStatus(data.status),
        };
    });
}
