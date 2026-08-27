"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError, formatApiError } from "@/lib/api";
import { Button, Field, Input, Alert } from "@/components/ui";

type View = "signin" | "forgot";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>("signin");

  // Sign in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Forgot password state
  const [fpEmail, setFpEmail] = useState("");
  const [fpSent, setFpSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchView(v: View) {
    setView(v);
    setError(null);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(siEmail, siPassword);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "ACCESS DENIED");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: fpEmail },
        skipAuth: true,
      });
      setFpSent(true);
    } catch (err) {
      setError(formatApiError(err, "REQUEST FAILED"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border-4 border-border-strong bg-bg-panel-alt shadow-[16px_16px_0px_0px_var(--shadow-strong)]">
        {/* Logo */}
        <div className="p-8 md:px-12 md:pt-12 md:pb-8 border-b-4 border-border-strong text-center">
          <span className="brand-mark w-14 h-14 mx-auto mb-4 block" role="img" aria-label="Garia Solutions" />
          <h1 className="font-display-xl text-5xl font-black text-brand-green tracking-tighter uppercase leading-none mb-4">
            GARIA<br />SOLUTIONS
          </h1>
          <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest inline-flex items-center gap-3">
            <span className="w-3 h-3 bg-brand-green border border-border-strong"></span>
            CLIENT PORTAL
          </p>
        </div>

        <div className="p-8 md:p-12">
          {error && <Alert kind="error" className="mb-6">{error}</Alert>}

          {/* ── Sign In ── */}
          {view === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-6">
              <Field>
                <label className="mb-3 block font-label-caps text-label-caps tracking-[0.1em] uppercase text-text-main">
                  Email
                </label>
                <Input
                  type="email"
                  required
                  value={siEmail}
                  onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-bg-base border-border-strong text-text-main shadow-[4px_4px_0px_0px_var(--shadow-strong)] focus:shadow-[4px_4px_0px_0px_var(--brand-green)]"
                />
              </Field>

              <Field>
                <label className="mb-3 block font-label-caps text-label-caps tracking-[0.1em] uppercase text-text-main">
                  Password
                </label>
                <Input
                  type="password"
                  required
                  value={siPassword}
                  onChange={(e) => setSiPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-bg-base border-border-strong text-text-main shadow-[4px_4px_0px_0px_var(--shadow-strong)] focus:shadow-[4px_4px_0px_0px_var(--brand-green)]"
                />
              </Field>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => switchView("forgot")}
                  className="font-data-mono text-data-mono text-text-muted uppercase tracking-wider hover:text-brand-green transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-on-brand-green border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 text-lg py-5"
              >
                {loading ? "AUTHENTICATING..." : "SIGN IN"}
              </Button>
            </form>
          )}

          {/* ── Forgot Password ── */}
          {view === "forgot" && (
            <>
              {fpSent ? (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-positive border-4 border-border-strong mx-auto flex items-center justify-center shadow-[6px_6px_0px_0px_var(--shadow-strong)]">
                    <span className="text-white text-2xl font-black">✓</span>
                  </div>
                  <div>
                    <p className="font-label-caps text-label-caps tracking-[0.1em] uppercase text-text-main mb-2">
                      Check your inbox
                    </p>
                    <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-wider">
                      Reset instructions sent to<br />
                      <span className="text-text-main">{fpEmail}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFpSent(false); setFpEmail(""); switchView("signin"); }}
                    className="font-data-mono text-data-mono text-brand-green uppercase tracking-wider hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-wider leading-relaxed">
                    Enter your email and we&apos;ll send you a link to reset your password.
                  </p>

                  <Field>
                    <label className="mb-3 block font-label-caps text-label-caps tracking-[0.1em] uppercase text-text-main">
                      Email
                    </label>
                    <Input
                      type="email"
                      required
                      value={fpEmail}
                      onChange={(e) => setFpEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="bg-bg-base border-border-strong text-text-main shadow-[4px_4px_0px_0px_var(--shadow-strong)] focus:shadow-[4px_4px_0px_0px_var(--brand-green)]"
                    />
                  </Field>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-green text-on-brand-green border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 text-lg py-5"
                  >
                    {loading ? "SENDING..." : "SEND RESET LINK"}
                  </Button>

                  <p className="text-center font-data-mono text-data-mono text-text-muted uppercase tracking-wider">
                    Remember it?{" "}
                    <button
                      type="button"
                      onClick={() => switchView("signin")}
                      className="text-brand-green hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
