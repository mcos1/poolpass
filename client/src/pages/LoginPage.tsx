import { useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={user.role === "admin" ? "/admin/calendar" : "/tech"} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Pool Pass</h1>
      <p className="mb-8 text-sm text-slate-400">Sign in with your email or username.</p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <label className="block text-sm">
          <span className="text-slate-300">Email or username</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Password</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">
        Need an account? Ask an admin to create one on the Team page.
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold text-slate-100">Pool Pass</span>
          {user?.role === "admin" && (
            <nav className="flex gap-3 text-slate-400">
              <Link className="hover:text-slate-100" to="/admin/calendar">
                Calendar
              </Link>
              <Link className="hover:text-slate-100" to="/admin/series">
                Recurring
              </Link>
              <Link className="hover:text-slate-100" to="/admin/team">
                Team
              </Link>
            </nav>
          )}
          {user?.role === "tech" && (
            <nav className="text-slate-400">
              <Link className="hover:text-slate-100" to="/tech">
                My schedule
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="hidden sm:inline">{user?.name}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs hover:bg-slate-900"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
