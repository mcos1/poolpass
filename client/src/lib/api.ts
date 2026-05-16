import { getAccessToken } from "./tokenStore";
import type { Job, JobSeries, UserSummary } from "../types";

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const res = await fetch(path, { ...init, headers, credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) {
    const msg = data?.error ?? res.statusText;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export async function login(username: string, password: string) {
  return request<{ accessToken: string; user: UserSummary }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function refreshSession() {
  return request<{ accessToken: string; user: UserSummary }>("/auth/refresh", {
    method: "POST",
  });
}

export async function logout() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function fetchMe() {
  return request<UserSummary>("/auth/me");
}

export async function fetchUsers() {
  return request<UserSummary[]>("/api/users");
}

export async function createUser(body: {
  email?: string;
  password: string;
  name: string;
  role?: "admin" | "tech";
}) {
  return request<UserSummary>("/api/users", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchJobs(from: Date, to: Date) {
  const qs = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return request<(Job & { assignedTechs?: UserSummary[] })[]>(`/api/jobs?${qs.toString()}`);
}

export async function createJob(body: Partial<Job> & { title: string; address: string; start: string; end: string }) {
  return request<Job>("/api/jobs", { method: "POST", body: JSON.stringify(body) });
}

export async function patchJob(id: string, body: Partial<Job>, scope?: "occurrence" | "series") {
  const q = scope ? `?scope=${scope}` : "";
  return request<Job | { ok: boolean; scope: string; seriesId: string }>(`/api/jobs/${id}${q}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteJob(id: string) {
  return request<{ ok: boolean }>(`/api/jobs/${id}`, { method: "DELETE" });
}

export async function addJobNote(jobId: string, text: string) {
  return request<{ id: string; text: string; authorId: string; createdAt: string }>(
    `/api/jobs/${jobId}/notes`,
    { method: "POST", body: JSON.stringify({ text }) }
  );
}

export async function fetchJobSeriesList() {
  return request<JobSeries[]>("/api/job-series");
}

export type CreateJobSeriesBody = {
  title: string;
  description?: string;
  address: string;
  durationMinutes?: number;
  startTimeHour?: number;
  startTimeMinute?: number;
  assignedTechIds?: string[];
  recurrence: {
    frequency: "weekly";
    interval?: number;
    byWeekday: number[];
    until?: string | null;
  };
};

export async function createJobSeries(body: CreateJobSeriesBody) {
  return request<JobSeries>("/api/job-series", { method: "POST", body: JSON.stringify(body) });
}

export async function patchJobSeries(id: string, body: Partial<JobSeries> & { regenerateInstances?: boolean }) {
  return request<JobSeries>(`/api/job-series/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteJobSeries(id: string) {
  return request<{ ok: boolean }>(`/api/job-series/${id}`, { method: "DELETE" });
}
