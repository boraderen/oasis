"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import DotGrid from "@/components/dot-grid";
import { useSession } from "@/components/session-provider";
import { apiRequest } from "@/lib/api";
import { setAuthToken } from "@/lib/auth-token";
import type { AuthResponse } from "@/lib/types";

import styles from "./page.module.css";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, bootstrap } = useSession();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await apiRequest<AuthResponse>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (!response.access_token) {
        throw new Error("Authentication token missing from backend response.");
      }

      setAuthToken(response.access_token);
      await bootstrap(response.user);
      router.replace("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await apiRequest<AuthResponse>("/api/auth/guest", {
        method: "POST",
      });

      if (!response.access_token) {
        throw new Error("Authentication token missing from backend response.");
      }

      setAuthToken(response.access_token);
      await bootstrap(response.user);
      router.replace("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Guest login failed");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "login" ? "Sign in" : "Register";
  const submitLabel = busy ? "Working…" : mode === "login" ? "Sign in" : "Register";
  const canSubmit = !busy && username.trim().length > 0 && password.trim().length > 0;

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.formPanel}>
          <div className={styles.brandBar}>
            <span className={styles.brand}>Oasis</span>
          </div>

          <div className={styles.formWrap}>
            <div className={styles.modeRow}>
              <div className={styles.modeTabs}>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === "login" ? styles.modeButtonActive : ""}`.trim()}
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === "register" ? styles.modeButtonActive : ""}`.trim()}
                  onClick={() => setMode("register")}
                >
                  Register
                </button>
              </div>
            </div>

            <h1 className={styles.title}>{title}</h1>

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) {
                  void submit();
                }
              }}
            >
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Email</span>
                <input
                  className={styles.input}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete={mode === "login" ? "username" : "email"}
                />
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.label}>Password</span>
                <span className={styles.passwordField}>
                  <input
                    className={styles.passwordInput}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className={styles.eyeButton}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3.1" />
                    </svg>
                  </button>
                </span>
              </label>

              {error ? <div className={styles.error}>{error}</div> : null}

              <div className={styles.actionStack}>
                <button
                  type="submit"
                  className={`${styles.submitButton} ${canSubmit ? styles.submitButtonEnabled : ""}`.trim()}
                  disabled={!canSubmit}
                >
                  {submitLabel}
                </button>

                <button
                  type="button"
                  className={styles.guestButton}
                  disabled={busy}
                  onClick={() => void continueAsGuest()}
                >
                  Continue as guest
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className={styles.visualPanel}>
          <DotGrid
            dotSize={5}
            gap={15}
            baseColor="#271E37"
            activeColor="#5227FF"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>
      </section>
    </main>
  );
}
