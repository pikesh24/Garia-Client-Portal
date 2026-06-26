"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button, Field, Input, Alert } from "@/components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "ACCESS DENIED");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border-4 border-border-strong bg-bg-panel-alt shadow-[16px_16px_0px_0px_var(--border-strong)] p-8 md:p-12">
        <div className="mb-10 border-b-4 border-border-strong pb-8 text-center">
          <h1 className="font-display-xl text-5xl font-black text-coral-red tracking-tighter uppercase leading-none mb-4">
            GARIA<br />SOLUTIONS
          </h1>
          <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest inline-flex items-center gap-3">
            <span className="w-3 h-3 bg-coral-red border border-border-strong"></span>
            CLIENT PORTAL LOGIN
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert kind="error">{error}</Alert>}

          <Field>
            <label className="mb-3 block font-label-caps text-label-caps tracking-[0.1em] uppercase text-text-main">
              EMAIL AUTHORIZATION
            </label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-bg-base border-border-strong text-text-main shadow-[4px_4px_0px_0px_var(--border-strong)] focus:shadow-[4px_4px_0px_0px_#ED4A3F]"
            />
          </Field>

          <Field>
            <label className="mb-3 block font-label-caps text-label-caps tracking-[0.1em] uppercase text-text-main">
              ACCESS CIPHER (PASSWORD)
            </label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-bg-base border-border-strong text-text-main shadow-[4px_4px_0px_0px_var(--border-strong)] focus:shadow-[4px_4px_0px_0px_#ED4A3F]"
            />
          </Field>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-coral-red text-white border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 text-lg py-5"
            >
              {loading ? "AUTHENTICATING..." : "LOGIN"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
