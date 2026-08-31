/**
 * Episode-level watch progress.
 *
 * Firestore layout: users/{uid}/watch-progress/{animeId}
 *   { animeId, title, poster, season, episode, currentTime, duration, updatedAt: Timestamp }
 */

import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
} from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "./firebase";

const MAX_RESULTS = 60;

export interface WatchProgressInput {
    animeId: string;
    title: string;
    poster: string;
    season: number;
    episode: number;
    currentTime: number;
    duration: number;
}

export interface WatchProgressItem
    extends Omit<WatchProgressInput, "currentTime" | "duration"> {
    currentTime: number | null;
    duration: number | null;
    updatedAt: number | null;
}

function progressDoc(uid: string, animeId: string) {
    return doc(getFirebaseDb(), "users", uid, "watch-progress", animeId);
}

function isCurrentUser(uid: string): boolean {
    return getFirebaseAuth().currentUser?.uid === uid;
}

export async function recordWatchProgress(
    uid: string,
    entry: WatchProgressInput
): Promise<void> {
    if (
        !entry.animeId ||
        !Number.isInteger(entry.season) ||
        entry.season < 0 ||
        !Number.isInteger(entry.episode) ||
        entry.episode < 1 ||
        !Number.isFinite(entry.currentTime) ||
        entry.currentTime < 0 ||
        !Number.isFinite(entry.duration) ||
        entry.duration < 0 ||
        !isCurrentUser(uid)
    ) {
        return;
    }

    const safeCurrentTime =
        entry.duration > 0
            ? Math.min(entry.currentTime, entry.duration)
            : entry.currentTime;
    const completed =
        entry.duration > 0 &&
        entry.duration - safeCurrentTime <= 10;

    await setDoc(
        progressDoc(uid, entry.animeId),
        {
            animeId: entry.animeId,
            title: entry.title,
            poster: entry.poster,
            season: entry.season,
            episode: entry.episode,
            // A completed episode should reopen from the beginning rather
            // than resume on its final frame.
            currentTime: completed ? 0 : safeCurrentTime,
            duration: entry.duration,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

function mapProgress(
    data: Record<string, unknown>,
    fallbackId: string
): WatchProgressItem | null {
    const episode = data.episode;
    if (
        typeof episode !== "number" ||
        !Number.isInteger(episode) ||
        episode < 1
    ) {
        return null;
    }

    const season = data.season;
    const currentTime = data.currentTime;
    const duration = data.duration;

    const updatedAt = data.updatedAt;

    return {
        animeId:
            typeof data.animeId === "string" ? data.animeId : fallbackId,
        title: typeof data.title === "string" ? data.title : "Untitled",
        poster: typeof data.poster === "string" ? data.poster : "",
        season:
            typeof season === "number" && Number.isInteger(season) && season >= 0
                ? season
                : 1,
        episode,
        currentTime:
            typeof currentTime === "number" && Number.isFinite(currentTime) && currentTime >= 0
                ? currentTime
                : null,
        duration:
            typeof duration === "number" && Number.isFinite(duration) && duration > 0
                ? duration
                : null,
        updatedAt: updatedAt instanceof Timestamp ? updatedAt.toMillis() : null,
    };
}

export async function getWatchProgress(
    uid: string,
    animeId: string
): Promise<WatchProgressItem | null> {
    if (!animeId || !isCurrentUser(uid)) return null;

    const snapshot = await getDoc(progressDoc(uid, animeId));
    return snapshot.exists()
        ? mapProgress(snapshot.data(), animeId)
        : null;
}

export async function fetchWatchProgress(
    uid: string
): Promise<WatchProgressItem[]> {
    if (!isCurrentUser(uid)) return [];

    const snapshot = await getDocs(
        query(
            collection(getFirebaseDb(), "users", uid, "watch-progress"),
            orderBy("updatedAt", "desc"),
            limit(MAX_RESULTS)
        )
    );

    return snapshot.docs
        .map((entry) => mapProgress(entry.data(), entry.id))
        .filter((entry): entry is WatchProgressItem => entry !== null);
}

export async function removeWatchProgress(
    uid: string,
    animeId: string
): Promise<void> {
    if (!animeId || !isCurrentUser(uid)) return;
    await deleteDoc(progressDoc(uid, animeId));
}

export async function clearWatchProgress(uid: string): Promise<void> {
    if (!isCurrentUser(uid)) return;

    const snapshot = await getDocs(
        collection(getFirebaseDb(), "users", uid, "watch-progress")
    );

    await Promise.all(
        snapshot.docs.map((entry) => deleteDoc(entry.ref))
    );
}
