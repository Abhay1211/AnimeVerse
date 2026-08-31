/**
 * Favorites data helper.
 *
 * Firestore layout: users/{uid}/favorites/{animeId}
 *   { animeId: string, title: string, poster: string, favoritedAt: Timestamp }
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

export interface FavoriteAnimeInput {
    animeId: string;
    title: string;
    poster: string;
}

export interface FavoriteAnimeItem extends FavoriteAnimeInput {
    /** Epoch ms, or null while the server timestamp is still resolving. */
    favoritedAt: number | null;
}

function favoriteDoc(uid: string, animeId: string) {
    return doc(getFirebaseDb(), "users", uid, "favorites", animeId);
}

function isCurrentUser(uid: string): boolean {
    return getFirebaseAuth().currentUser?.uid === uid;
}

export async function addFavorite(
    uid: string,
    entry: FavoriteAnimeInput
): Promise<void> {
    if (!entry.animeId || !isCurrentUser(uid)) return;

    await setDoc(
        favoriteDoc(uid, entry.animeId),
        {
            animeId: entry.animeId,
            title: entry.title,
            poster: entry.poster,
            favoritedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

export async function removeFavorite(
    uid: string,
    animeId: string
): Promise<void> {
    if (!animeId || !isCurrentUser(uid)) return;
    await deleteDoc(favoriteDoc(uid, animeId));
}

export async function isAnimeFavorited(
    uid: string,
    animeId: string
): Promise<boolean> {
    if (!animeId || !isCurrentUser(uid)) return false;
    const snapshot = await getDoc(favoriteDoc(uid, animeId));
    return snapshot.exists();
}

export async function fetchFavorites(
    uid: string
): Promise<FavoriteAnimeItem[]> {
    if (!isCurrentUser(uid)) return [];

    const snapshot = await getDocs(
        query(
            collection(getFirebaseDb(), "users", uid, "favorites"),
            orderBy("favoritedAt", "desc"),
            limit(MAX_RESULTS)
        )
    );

    return snapshot.docs.map((entry) => {
        const data = entry.data();
        const favoritedAt = data.favoritedAt;

        return {
            animeId:
                typeof data.animeId === "string" ? data.animeId : entry.id,
            title: typeof data.title === "string" ? data.title : "Untitled",
            poster: typeof data.poster === "string" ? data.poster : "",
            favoritedAt:
                favoritedAt instanceof Timestamp
                    ? favoritedAt.toMillis()
                    : null,
        };
    });
}
