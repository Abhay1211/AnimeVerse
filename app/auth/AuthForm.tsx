"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signIn, signUp, type AuthResult } from "./authActions";

// Where a signed-in user lands — the AnimeVerse app home (same target as the
// navbar's "Home" item).
const POST_AUTH_ROUTE = "/anime";

export type AuthMode = "signin" | "signup";

type FieldName = "displayName" | "email" | "password";

interface FieldConfig {
    label: string;
    placeholder: string;
    type: "text" | "email" | "password";
    autoComplete: string;
}

const FIELDS: Record<FieldName, FieldConfig> = {
    displayName: {
        label: "Display Name",
        placeholder: "Anime Fan",
        type: "text",
        autoComplete: "nickname",
    },
    email: {
        label: "Email",
        placeholder: "you@example.com",
        type: "email",
        autoComplete: "email",
    },
    password: {
        label: "Password",
        placeholder: "Enter your password",
        type: "password",
        autoComplete: "current-password",
    },
};

const MODE_FIELDS: Record<AuthMode, FieldName[]> = {
    signin: ["email", "password"],
    signup: ["displayName", "email", "password"],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateField(name: FieldName, value: string): string | null {
    const trimmed = value.trim();

    switch (name) {
        case "email":
            if (!trimmed) return "Email is required.";
            if (!EMAIL_RE.test(trimmed))
                return "Enter a valid email address.";
            return null;
        case "password":
            if (!value) return "Password is required.";
            return null;
        case "displayName":
            if (!trimmed) return "Display name is required.";
            return null;
        default:
            return null;
    }
}

const EMPTY_VALUES: Record<FieldName, string> = {
    displayName: "",
    email: "",
    password: "",
};

export default function AuthForm({ mode }: { mode: AuthMode }) {
    const router = useRouter();
    const fields = MODE_FIELDS[mode];

    const [values, setValues] =
        useState<Record<FieldName, string>>(EMPTY_VALUES);
    const [errors, setErrors] = useState<
        Partial<Record<FieldName, string>>
    >({});
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    function handleChange(name: FieldName, value: string) {
        setValues((prev) => ({ ...prev, [name]: value }));
        setNotice(null);

        // Only refresh a message that is already showing — don't start
        // flagging a field the user is still filling in.
        setErrors((prev) => {
            if (!prev[name]) return prev;

            const next = validateField(name, value);
            if (next === prev[name]) return prev;

            const copy = { ...prev };
            if (next) copy[name] = next;
            else delete copy[name];
            return copy;
        });
    }

    function handleBlur(name: FieldName) {
        const message = validateField(name, values[name]);
        setErrors((prev) => {
            const copy = { ...prev };
            if (message) copy[name] = message;
            else delete copy[name];
            return copy;
        });
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        const nextErrors: Partial<Record<FieldName, string>> = {};
        for (const name of fields) {
            const message = validateField(name, values[name]);
            if (message) nextErrors[name] = message;
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSubmitting(true);
        setNotice(null);

        const result: AuthResult =
            mode === "signin"
                ? await signIn({
                      email: values.email.trim(),
                      password: values.password,
                  })
                : await signUp({
                      displayName: values.displayName.trim(),
                      email: values.email.trim(),
                      password: values.password,
                  });

        if (result.status === "ok") {
            // Leave the button in its loading state while the redirect runs.
            router.push(POST_AUTH_ROUTE);
            return;
        }

        setSubmitting(false);
        setNotice(result.message);
    }

    const submitLabel =
        mode === "signin"
            ? submitting
                ? "Signing In..."
                : "Sign In"
            : submitting
              ? "Creating Account..."
              : "Create Account";

    return (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {fields.map((name) => {
                const config = FIELDS[name];
                const isPassword = name === "password";
                const error = errors[name];
                const inputType = isPassword
                    ? showPassword
                        ? "text"
                        : "password"
                    : config.type;

                return (
                    <div className="auth-field" key={name}>
                        <label
                            className="auth-label"
                            htmlFor={`auth-${name}`}
                        >
                            {config.label}
                        </label>

                        <div
                            className={`auth-input-shell${
                                error ? " has-error" : ""
                            }`}
                        >
                            <input
                                id={`auth-${name}`}
                                className="auth-input font-mono"
                                type={inputType}
                                name={name}
                                value={values[name]}
                                placeholder={config.placeholder}
                                autoComplete={
                                    isPassword && mode === "signup"
                                        ? "new-password"
                                        : config.autoComplete
                                }
                                spellCheck={false}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={
                                    error
                                        ? `auth-${name}-error`
                                        : undefined
                                }
                                onChange={(event) =>
                                    handleChange(name, event.target.value)
                                }
                                onBlur={() => handleBlur(name)}
                            />

                            {isPassword && (
                                <button
                                    type="button"
                                    className="auth-reveal"
                                    onClick={() =>
                                        setShowPassword((shown) => !shown)
                                    }
                                    aria-pressed={showPassword}
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff size={16} />
                                    ) : (
                                        <Eye size={16} />
                                    )}
                                </button>
                            )}
                        </div>

                        {error && (
                            <p
                                className="auth-error"
                                id={`auth-${name}-error`}
                            >
                                {error}
                            </p>
                        )}
                    </div>
                );
            })}

            {notice && (
                <p className="auth-notice" role="status">
                    {notice}
                </p>
            )}

            <button
                type="submit"
                className="auth-submit font-mono"
                disabled={submitting}
                aria-busy={submitting}
            >
                {submitLabel}
            </button>
        </form>
    );
}
