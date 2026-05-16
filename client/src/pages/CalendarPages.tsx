import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, EventDropArg, EventApi } from "@fullcalendar/core";
import { addJobNote, createJob, deleteJob, fetchJobs, fetchUsers, patchJob } from "../lib/api";
import type { Job, UserSummary } from "../types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

const ALL_CALENDARS_KEY = "all";

function assignmentKey(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return sorted.length ? sorted.join("|") : "unassigned";
}

function assignmentIdsFromKey(key: string) {
  if (key === ALL_CALENDARS_KEY || key === "unassigned") return [];
  return key.split("|").filter(Boolean);
}

function assignmentLabel(ids: string[], techs: UserSummary[]) {
  if (!ids.length) return "Unassigned";
  const names = ids.map((id) => techs.find((tech) => tech.id === id)?.name ?? "Unknown tech");
  return names.join(" + ");
}

export function AdminCalendarPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null);
  const [activeCalendarKey, setActiveCalendarKey] = useState(ALL_CALENDARS_KEY);
  const [modal, setModal] = useState<
    | { mode: "create"; start: string; end: string }
    | { mode: "edit"; job: Job }
    | null
  >(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", range?.from.toISOString(), range?.to.toISOString()],
    queryFn: () => fetchJobs(range!.from, range!.to),
    enabled: !!range,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const techs = useMemo(() => users.filter((u) => u.role === "tech"), [users]);

  const calendarTabs = useMemo(() => {
    const grouped = new Map<string, { key: string; ids: string[]; count: number }>();

    for (const job of jobs) {
      const ids = job.assignedTechIds ?? [];
      const key = assignmentKey(ids);
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, { key, ids: [...new Set(ids)].sort(), count: 1 });
      }
    }

    return [
      { key: ALL_CALENDARS_KEY, label: "All", count: jobs.length, ids: [] },
      ...Array.from(grouped.values())
        .sort((a, b) => assignmentLabel(a.ids, techs).localeCompare(assignmentLabel(b.ids, techs)))
        .map((tab) => ({
          ...tab,
          label: assignmentLabel(tab.ids, techs),
        })),
    ];
  }, [jobs, techs]);

  useEffect(() => {
    if (!calendarTabs.some((tab) => tab.key === activeCalendarKey)) {
      setActiveCalendarKey(ALL_CALENDARS_KEY);
    }
  }, [activeCalendarKey, calendarTabs]);

  const visibleJobs = useMemo(() => {
    if (activeCalendarKey === ALL_CALENDARS_KEY) return jobs;
    return jobs.filter((job) => assignmentKey(job.assignedTechIds ?? []) === activeCalendarKey);
  }, [activeCalendarKey, jobs]);

  const events = useMemo(
    () =>
      visibleJobs.map((j) => ({
        id: j.id,
        title: j.title,
        start: j.start,
        end: j.end,
        extendedProps: { job: j },
      })),
    [visibleJobs]
  );

  const createMut = useMutation({
    mutationFn: createJob,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"], exact: false }),
  });

  const patchMut = useMutation({
    mutationFn: (args: { id: string; body: Partial<Job>; scope?: "occurrence" | "series" }) =>
      patchJob(args.id, args.body, args.scope),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"], exact: false }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"], exact: false }),
  });

  function onDatesSet(arg: { start: Date; end: Date }) {
    setRange({ from: arg.start, to: arg.end });
  }

  function onSelect(sel: DateSelectArg) {
    setModal({
      mode: "create",
      start: sel.start.toISOString(),
      end: sel.end ? sel.end.toISOString() : new Date(sel.start.getTime() + 60 * 60 * 1000).toISOString(),
    });
  }

  function onEventClick(info: EventClickArg) {
    const job = info.event.extendedProps.job as Job;
    setModal({ mode: "edit", job });
  }

  function onEventDrop(info: EventDropArg) {
    const job = info.event.extendedProps.job as Job;
    const start = info.event.start!;
    const end =
      info.event.end ??
      new Date(start.getTime() + (new Date(job.end).getTime() - new Date(job.start).getTime()));
    patchMut.mutate({
      id: job.id,
      body: {
        title: job.title,
        description: job.description,
        address: job.address,
        assignedTechIds: job.assignedTechIds,
        status: job.status,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  }

  function onEventResize(info: { event: EventApi }) {
    const job = info.event.extendedProps.job as Job;
    const start = info.event.start!;
    const end = info.event.end!;
    patchMut.mutate({
      id: job.id,
      body: {
        title: job.title,
        description: job.description,
        address: job.address,
        assignedTechIds: job.assignedTechIds,
        status: job.status,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Job calendar</h1>
          <p className="text-sm text-slate-400">Drag to create, drag events to reschedule.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-t-xl border border-b-0 border-slate-800 bg-slate-950">
        <div className="flex min-w-max items-end px-2 pt-2">
          {calendarTabs.map((tab) => {
            const active = tab.key === activeCalendarKey;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCalendarKey(tab.key)}
                className={`relative -mb-px max-w-56 truncate rounded-t-lg border px-4 py-2 text-sm transition ${
                  active
                    ? "border-slate-700 border-b-slate-900 bg-slate-900 text-slate-100"
                    : "border-transparent bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
                title={tab.label}
              >
                <span className="truncate">{tab.label}</span>
                <span className="ml-2 rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-b-xl border border-slate-800 bg-slate-900/40 p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          editable
          selectable
          selectMirror
          dayMaxEvents
          height="auto"
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          events={events}
          datesSet={onDatesSet}
          select={onSelect}
          eventClick={onEventClick}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          eventContent={(arg) => ({
            html: `<div class="whitespace-nowrap truncate">${arg.event.title}</div>`,
          })}
        />
      </div>

      {modal?.mode === "create" && (
        <JobFormModal
          title="New job"
          users={users.filter((u) => u.role === "tech")}
          initial={{
            title: "",
            description: "",
            address: "",
            start: modal.start,
            end: modal.end,
            assignedTechIds: assignmentIdsFromKey(activeCalendarKey),
            status: "scheduled",
          }}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            await createMut.mutateAsync(values);
            setModal(null);
          }}
        />
      )}

      {modal?.mode === "edit" && (
        <JobFormModal
          title="Edit job"
          users={users.filter((u) => u.role === "tech")}
          initial={{
            title: modal.job.title,
            description: modal.job.description,
            address: modal.job.address,
            start: modal.job.start,
            end: modal.job.end,
            assignedTechIds: modal.job.assignedTechIds,
            status: modal.job.status,
          }}
          seriesId={modal.job.seriesId}
          onClose={() => setModal(null)}
          onSave={async (values, scope) => {
            await patchMut.mutateAsync({
              id: modal.job.id,
              body: values,
              scope,
            });
            setModal(null);
          }}
          onDelete={
            modal.job.seriesId
              ? undefined
              : async () => {
                  await deleteMut.mutateAsync(modal.job.id);
                  setModal(null);
                }
          }
        />
      )}
    </div>
  );
}

type JobFormValues = {
  title: string;
  description: string;
  address: string;
  start: string;
  end: string;
  assignedTechIds: string[];
  status: Job["status"];
};

function JobFormModal({
  title,
  users,
  initial,
  seriesId,
  onClose,
  onSave,
  onDelete,
}: {
  title: string;
  users: { id: string; name: string; email: string }[];
  initial: JobFormValues;
  seriesId?: string | null;
  onClose: () => void;
  onSave: (values: JobFormValues, scope?: "occurrence" | "series") => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [applySeries, setApplySeries] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(values, seriesId && applySeries ? "series" : "occurrence");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-slate-300">Title</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              value={values.title}
              onChange={(e) => setValues({ ...values, title: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="text-slate-300">Address</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              value={values.address}
              onChange={(e) => setValues({ ...values, address: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="text-slate-300">What to do</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              rows={3}
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-slate-300">Start</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2"
                value={toDatetimeLocalValue(values.start)}
                onChange={(e) => setValues({ ...values, start: fromDatetimeLocalValue(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="text-slate-300">End</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2"
                value={toDatetimeLocalValue(values.end)}
                onChange={(e) => setValues({ ...values, end: fromDatetimeLocalValue(e.target.value) })}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-slate-300">Assigned techs</span>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-3">
              {users.length === 0 ? (
                <p className="text-sm text-slate-500">No techs available</p>
              ) : (
                users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values.assignedTechIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setValues({ ...values, assignedTechIds: [...values.assignedTechIds, u.id] });
                        } else {
                          setValues({
                            ...values,
                            assignedTechIds: values.assignedTechIds.filter((id) => id !== u.id),
                          });
                        }
                      }}
                    />
                    <span className="text-sm text-slate-300">{u.name} {u.email && `(${u.email})`}</span>
                  </label>
                ))
              )}
            </div>
          </label>
          <label className="block">
            <span className="text-slate-300">Status</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2"
              value={values.status}
              onChange={(e) => setValues({ ...values, status: e.target.value as Job["status"] })}
            >
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          {seriesId && (
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={applySeries}
                onChange={(e) => setApplySeries(e.target.checked)}
              />
              Apply title, description, address, and techs to the whole recurring series (future visits
              regenerated)
            </label>
          )}

          {error && <p className="text-rose-400">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {onDelete && (
              <button
                type="button"
                className="rounded-lg border border-rose-900 px-3 py-2 text-rose-300 hover:bg-rose-950"
                onClick={() => void onDelete()}
              >
                Delete
              </button>
            )}
            <button type="button" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-900" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TechSchedulePage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", range?.from.toISOString(), range?.to.toISOString()],
    queryFn: () => fetchJobs(range!.from, range!.to),
    enabled: !!range,
  });

  const noteMut = useMutation({
    mutationFn: (text: string) => addJobNote(selected!.id, text),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"], exact: false }),
  });

  useEffect(() => {
    if (!selected) return;
    const next = jobs.find((j) => j.id === selected.id);
    if (next) setSelected(next);
  }, [jobs, selected?.id]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My schedule</h1>
        <p className="text-sm text-slate-400">Tap a job to see details and add notes.</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="auto"
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          events={jobs.map((j) => ({
            id: j.id,
            title: j.title,
            start: j.start,
            end: j.end,
            extendedProps: { job: j },
          }))}
          datesSet={(arg) => setRange({ from: arg.start, to: arg.end })}
          eventClick={(info) => setSelected(info.event.extendedProps.job as Job)}
          eventContent={(arg) => ({
            html: `<div class="whitespace-nowrap truncate">${arg.event.title}</div>`,
          })}
        />
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{selected.title}</h2>
            <dl className="mt-4 space-y-2 text-sm text-slate-300">
              <div>
                <dt className="text-xs uppercase text-slate-500">When</dt>
                <dd>
                  {new Date(selected.start).toLocaleString()} – {new Date(selected.end).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Where</dt>
                <dd>{selected.address}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">What</dt>
                <dd className="whitespace-pre-wrap">{selected.description || "—"}</dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-200">Notes</h3>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-300">
                {selected.notes?.length ? (
                  selected.notes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-slate-900/80 px-3 py-2">
                      <p className="whitespace-pre-wrap">{n.text}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</p>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">No notes yet.</li>
                )}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const text = String(fd.get("text") || "").trim();
                  if (!text) return;
                  noteMut.mutate(text, {
                    onSuccess: () => {
                      e.currentTarget.reset();
                    },
                  });
                }}
              >
                <textarea
                  name="text"
                  rows={2}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Add a note for this job…"
                />
                <button
                  type="submit"
                  className="self-end rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Add
                </button>
              </form>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
