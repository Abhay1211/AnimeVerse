"use client";

/**
 * Shared Firebase auth-state hook.
 *
 * One `onAuthStateChanged` listener for the whole app: the first component that
 * uses the hook starts it, every consumer reads the same snapshot via
 * `useSyncExternalStore`. Browser-only and lazy — `getFirebaseAuth()` is never
 * called during SSR/prerender (React uses `getServerSnapshot` there), so this
 * preserves the existing lazy Firebase architecture and causes no hydration
 * mismatch (`{ user: null, loading: true }` on server and first client render).
 */

import { onAuthStateChanged, type User } from "firebase/auth";
import { useSyncExternalStore } from "react";

import { getFirebaseAuth } from "./firebase";

export interface AuthUserState {
    user: User | null;
    /** True until the first `onAuthStateChanged` callback resolves. */
    loading: boolean;
}

/**
 * Shared by `getSnapshot` (until auth resolves) and `getServerSnapshot`, so the
 * server snapshot and the first client snapshot are the SAME reference. If they
 * differed, `useSyncExternalStore` would treat hydration as a store change and
 * force an extra re-render of every consumer (the navbar included).
 */
const INITIAL_STATE: AuthUserState = { user: null, loading: true };

let state: AuthUserState = INITIAL_STATE;
const listeners = new Set<() => void>();
let started = false;

function ensureListener() {
    if (started || typeof window === "undefined") return;
    started = true;

    onAuthStateChanged(getFirebaseAuth(), (user) => {
        state = { user, loading: false };
        listeners.forEach((notify) => notify());
    });
}

function subscribe(onStoreChange: () => void) {
    ensureListener();
    listeners.add(onStoreChange);
    return () => {
        listeners.delete(onStoreChange);
    };
}

/**
 * Force consumers to re-read the current Firebase user.
 *
 * `onAuthStateChanged` does NOT fire for in-place profile edits
 * (`updateProfile`), so after changing e.g. the display name, call this to
 * publish a fresh snapshot. The `User` object is mutated in place by the SDK,
 * so `state.user` keeps the same reference (effects keyed on `user` do not
 * re-run) while the new snapshot object still triggers a re-render.
 */
export function refreshAuthUser(): void {
    if (typeof window === "undefined") return;
    state = { user: getFirebaseAuth().currentUser, loading: false };
    listeners.forEach((notify) => notify());
}

function getSnapshot(): AuthUserState {
    return state;
}

function getServerSnapshot(): AuthUserState {
    return INITIAL_STATE;
}

export function useAuthUser(): AuthUserState {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
