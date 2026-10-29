import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { db } from "../lib/supabase";
import { errorMessage } from "../lib/api";
import { brand } from "../lib/brand";
import { BackendGate, Notice, PageHeading } from "../components/UI";
export default function Auth() {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const requested = params.get("next") ?? "";
  const next =
    requested === "/trips/new" || /^\/trips\/[0-9a-f-]{36}$/i.test(requested)
      ? requested
      : "/trips";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (session) return <Navigate to={next} replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await db().auth.signInWithPassword({ email, password })
          : await db().auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/trips` },
            });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session)
        setMessage(
          "Check your email to confirm your account, then return here to sign in.",
        );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace narrow">
      <PageHeading
        kicker="FOR THE GROUP LEADER"
        title={
          mode === "login" ? "Welcome back." : "Your next trip starts here."
        }
      >
        One place to bring your people, dates, and budgets together.
      </PageHeading>
      <BackendGate>
        <div className="panel">
          <div className="segmented">
            <button
              aria-pressed={mode === "login"}
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              Sign in
            </button>
            <button
              aria-pressed={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
            >
              Create account
            </button>
          </div>
          <form className="form-stack" onSubmit={submit}>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>At least 8 characters.</small>
            </label>
            {error && <Notice error>{error}</Notice>}
            {message && <Notice>{message}</Notice>}
            <button className="button button-dark" disabled={busy || loading}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in ↗"
                  : `Join ${brand.name} ↗`}
            </button>
          </form>
        </div>
        <p className="quiet">
          Friends can respond to invitations without an account.
        </p>
      </BackendGate>
    </div>
  );
}
