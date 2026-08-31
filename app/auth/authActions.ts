/**
 * Authentication action layer (Firebase Email/Password + Firestore profile).
 *
 * The UI (`AuthForm`) only depends on the exported signatures and the
 * `AuthResult` shape. Raw Firebase errors never reach the UI — they are mapped
 * to short, friendly messages here.
 *
 * Sign-up creates the Firebase Auth account, sets its displayName, then writes
 * `users/{uid}` in Firestore. Sign-in never touches Firestore. Firebase Auth
 * owns the password; it is never stored in Firestore or anywhere else.
 *
 * `updateDisplayName` / `changePassword` back the /profile account section:
 * display-name edits mirror to `users/{uid}`; password changes re-authenticate
 * with the current password first (Firebase's recent-login requirement).
 * No avatar upload (no Firebase Storage), no Google sign-in.
 */

import { FirebaseError } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "../lib/firebase";
import { refreshAuthUser } from "../lib/useAuthUser";

export interface SignInInput {
    email: string;
    password: string;
}

export interface SignUpInput extends SignInInput {
    displayName: string;
}

export type AuthResult =
    | { status: "ok" }
    | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const PROFILE_ERROR =
    "Your account was created, but setting up your profile failed. Please sign in to continue.";

/** Map a Firebase auth error code to a message safe to show the user. */
function messageForCode(code: string): string {
    switch (code) {
        case "auth/email-already-in-use":
            return "That email is already registered. Try signing in instead.";
        case "auth/invalid-email":
            return "Enter a valid email address.";
        case "auth/weak-password":
            return "Password should be at least 6 characters.";
        case "auth/missing-password":
            return "Password is required.";
        case "auth/wrong-password":
        case "auth/user-not-found":
        case "auth/invalid-credential":
            return "Incorrect email or password.";
        case "auth/user-disabled":
            return "This account has been disabled.";
        case "auth/too-many-requests":
            return "Too many attempts. Please wait a moment and try again.";
        case "auth/network-request-failed":
            return "Network error. Check your connection and try again.";
        case "auth/operation-not-allowed":
            return "Email/password sign-in is not enabled for this project.";
        case "auth/requires-recent-login":
            return "For your security, sign out and sign in again before changing your password.";
        case "auth/invalid-api-key":
        case "auth/configuration-not-found":
            return "Authentication is not configured correctly. Please try again later.";
        default:
            return GENERIC_ERROR;
    }
}

function toResult(error: unknown): AuthResult {
    if (error instanceof FirebaseError) {
        return { status: "error", message: messageForCode(error.code) };
    }
    return { status: "error", message: GENERIC_ERROR };
}

export async function signIn(input: SignInInput): Promise<AuthResult> {
    try {
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, input.email, input.password);
        return { status: "ok" };
    } catch (error) {
        return toResult(error);
    }
}

export async function signOutUser(): Promise<AuthResult> {
    try {
        await signOut(getFirebaseAuth());
        return { status: "ok" };
    } catch (error) {
        return toResult(error);
    }
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
    try {
        const auth = getFirebaseAuth();
        const credential = await createUserWithEmailAndPassword(
            auth,
            input.email,
            input.password
        );

        // Attach the chosen display name to the Firebase user. A failure here
        // does not undo the account, so it must not fail the whole sign-up.
        try {
            await updateProfile(credential.user, {
                displayName: input.displayName,
            });
        } catch {
            // Display name can be set again later; account already exists.
        }

        // Create the Firestore profile keyed by the Auth UID (never a new id).
        // The Auth account already exists at this point — if the profile write
        // fails we surface a distinct message rather than claiming full
        // failure, and we do NOT delete the account.
        try {
            await setDoc(doc(getFirebaseDb(), "users", credential.user.uid), {
                displayName: input.displayName,
                email: input.email,
                createdAt: serverTimestamp(),
            });
        } catch {
            return { status: "error", message: PROFILE_ERROR };
        }

        return { status: "ok" };
    } catch (error) {
        return toResult(error);
    }
}

/**
 * Update the signed-in user's display name on both the Firebase Auth profile
 * and the `users/{uid}` Firestore mirror (same fields sign-up writes). Callers
 * pass an already-trimmed value; an unchanged name is a no-op so we never issue
 * a needless write. On success the shared auth snapshot is refreshed so the
 * navbar / profile UI pick up the new name without a reload.
 */
export async function updateDisplayName(
    displayName: string
): Promise<AuthResult> {
    const name = displayName.trim();
    if (!name) {
        return { status: "error", message: "Display name is required." };
    }

    try {
        const user = getFirebaseAuth().currentUser;
        if (!user) {
            return { status: "error", message: "You are not signed in." };
        }

        if (name === (user.displayName ?? "").trim()) {
            return { status: "ok" };
        }

        await updateProfile(user, { displayName: name });

        try {
            await setDoc(
                doc(getFirebaseDb(), "users", user.uid),
                { displayName: name },
                { merge: true }
            );
        } catch {
            // The Auth profile is the source of truth for the display name;
            // the Firestore copy can catch up later. Don't fail the update.
        }

        refreshAuthUser();
        return { status: "ok" };
    } catch (error) {
        return toResult(error);
    }
}

/**
 * Change the signed-in user's password. Firebase requires a recent login for
 * this, so the current password is re-verified via
 * `reauthenticateWithCredential` first. Only email/password accounts can use
 * this. Callers validate the new password shape (length, confirmation) before
 * calling.
 */
export async function changePassword(
    currentPassword: string,
    newPassword: string
): Promise<AuthResult> {
    try {
        const user = getFirebaseAuth().currentUser;
        if (!user || !user.email) {
            return { status: "error", message: "You are not signed in." };
        }

        const credential = EmailAuthProvider.credential(
            user.email,
            currentPassword
        );

        try {
            await reauthenticateWithCredential(user, credential);
        } catch (error) {
            if (
                error instanceof FirebaseError &&
                (error.code === "auth/wrong-password" ||
                    error.code === "auth/invalid-credential" ||
                    error.code === "auth/missing-password")
            ) {
                return {
                    status: "error",
                    message: "Your current password is incorrect.",
                };
            }
            return toResult(error);
        }

        await updatePassword(user, newPassword);
        return { status: "ok" };
    } catch (error) {
        return toResult(error);
    }
}
