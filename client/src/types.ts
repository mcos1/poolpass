export type Role = "admin" | "tech";

export type JobNote = {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
};

export type Job = {
  id: string;
  title: string;
  description: string;
  address: string;
  start: string;
  end: string;
  assignedTechIds: string[];
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  createdBy?: string;
  seriesId: string | null;
  notes: JobNote[];
  createdAt?: string;
  updatedAt?: string;
  assignedTechs?: { id: string; name: string; email: string }[];
};

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active?: boolean;
};

export type JobSeries = {
  id: string;
  title: string;
  description: string;
  address: string;
  durationMinutes: number;
  startTimeHour: number;
  startTimeMinute: number;
  assignedTechIds: string[];
  recurrence: {
    frequency: "weekly";
    interval: number;
    byWeekday: number[];
    until?: string | null;
  };
  windowGeneratedUntil?: string | null;
};
