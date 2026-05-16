import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createJobSeries, deleteJobSeries, fetchJobSeriesList, fetchUsers } from "../lib/api";

const weekdays = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
];

export function SeriesPage() {
  const qc = useQueryClient();
  const { data: series = [] } = useQuery({ queryKey: ["job-series"], queryFn: fetchJobSeriesList });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTimeHour, setStartTimeHour] = useState(9);
  const [startTimeMinute, setStartTimeMinute] = useState(0);
  const [byWeekday, setByWeekday] = useState<number[]>([1, 3, 5]);
  const [assignedTechIds, setAssignedTechIds] = useState<string[]>([]);
  const [until, setUntil] = useState<string>("");

  const createMut = useMutation({
    mutationFn: () =>
      createJobSeries({
        title,
        description,
        address,
        durationMinutes,
        startTimeHour,
        startTimeMinute,
        assignedTechIds,
        recurrence: {
          frequency: "weekly",
          interval: 1,
          byWeekday,
          until: until ? new Date(until).toISOString() : null,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["job-series"] });
      void qc.invalidateQueries({ queryKey: ["jobs"], exact: false });
      setTitle("");
      setDescription("");
      setAddress("");
    },
  });

  const delMut = useMutation({
    mutationFn: deleteJobSeries,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["job-series"] });
      void qc.invalidateQueries({ queryKey: ["jobs"], exact: false });
    },
  });

  const techs = users.filter((u) => u.role === "tech");

  function toggleDay(d: number) {
    setByWeekday((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Recurring jobs</h1>
        <p className="text-sm text-slate-400">
          Weekly routes generate visits for the next 12 weeks. Times use your browser&apos;s local timezone
          when picking the schedule pattern (server stores UTC instants).
        </p>
      </div>

      <form
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!byWeekday.length) return;
          createMut.mutate();
        }}
      >
        <h2 className="font-medium text-slate-200">New recurring series</h2>
        <label className="block">
          <span className="text-slate-300">Title</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-slate-300">Address</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-slate-300">What to do</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-slate-300">Duration (min)</span>
            <input
              type="number"
              min={15}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-slate-300">Start hour</span>
            <input
              type="number"
              min={0}
              max={23}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={startTimeHour}
              onChange={(e) => setStartTimeHour(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-slate-300">Start minute</span>
            <input
              type="number"
              min={0}
              max={59}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={startTimeMinute}
              onChange={(e) => setStartTimeMinute(Number(e.target.value))}
            />
          </label>
        </div>
        <div>
          <span className="text-slate-300">Weekdays</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekdays.map((d) => (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleDay(d.v)}
                className={`rounded-lg border px-3 py-1 ${
                  byWeekday.includes(d.v)
                    ? "border-sky-500 bg-sky-600 text-white"
                    : "border-slate-700 bg-slate-950 text-slate-300"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-slate-300">Repeat until (optional)</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-slate-300">Default techs</span>
          <select
            multiple
            className="mt-1 h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2"
            value={assignedTechIds}
            onChange={(e) =>
              setAssignedTechIds(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
          >
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {createMut.isError && (
          <p className="text-rose-400">{createMut.error instanceof Error ? createMut.error.message : "Error"}</p>
        )}
        <button
          type="submit"
          disabled={createMut.isPending || !byWeekday.length}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {createMut.isPending ? "Creating…" : "Create series"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-medium text-slate-200">Existing series</h2>
        <ul className="space-y-2">
          {series.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-slate-500">
                  {s.recurrence.byWeekday.map((d) => weekdays.find((w) => w.v === d)?.label ?? d).join(", ")} ·{" "}
                  {s.startTimeHour}:{String(s.startTimeMinute).padStart(2, "0")} · {s.durationMinutes}m
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-rose-900 px-3 py-1 text-xs text-rose-300 hover:bg-rose-950"
                onClick={() => {
                  if (confirm("Delete this series and all generated visits?")) delMut.mutate(s.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
          {!series.length && <li className="text-slate-500">No recurring series yet.</li>}
        </ul>
      </div>
    </div>
  );
}
