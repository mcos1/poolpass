import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useLiveJobs } from "./hooks/useLiveJobs";
import { LoginPage, AppShell } from "./pages/LoginPage";
import { AdminCalendarPage, TechSchedulePage } from "./pages/CalendarPages";
import { TeamPage } from "./pages/TeamPage";
import { SeriesPage } from "./pages/SeriesPage";
import type { Role } from "./types";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin/calendar" : "/tech"} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/calendar" : "/tech"} replace />;
}

export default function App() {
  const { user, ready } = useAuth();
  useLiveJobs(ready && !!user);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomeRedirect />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/calendar"
        element={
          <RequireAuth>
            <RequireRole role="admin">
              <AppShell>
                <AdminCalendarPage />
              </AppShell>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/team"
        element={
          <RequireAuth>
            <RequireRole role="admin">
              <AppShell>
                <TeamPage />
              </AppShell>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/series"
        element={
          <RequireAuth>
            <RequireRole role="admin">
              <AppShell>
                <SeriesPage />
              </AppShell>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/tech"
        element={
          <RequireAuth>
            <RequireRole role="tech">
              <AppShell>
                <TechSchedulePage />
              </AppShell>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
