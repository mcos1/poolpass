import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Job } from "../models/Job.js";
import { JobSeries } from "../models/JobSeries.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { emitToCompany } from "../io.js";
import { regenerateSeriesWindow, materializeNewSeries } from "../utils/seriesMaterialize.js";

const router = Router();

function mapTechIds(arr) {
  if (!arr?.length) return [];
  return arr.map((x) => {
    if (x && typeof x === "object" && x._id) return x._id.toString();
    return x.toString();
  });
}

function serializeJob(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  return {
    id: o._id.toString(),
    title: o.title,
    description: o.description,
    address: o.address,
    start: o.start,
    end: o.end,
    assignedTechIds: mapTechIds(o.assignedTechIds),
    status: o.status,
    createdBy: o.createdBy?.toString(),
    seriesId: o.seriesId ? o.seriesId.toString() : null,
    notes: (o.notes || []).map((n) => ({
      id: n._id.toString(),
      text: n.text,
      authorId: n.authorId.toString(),
      createdAt: n.createdAt,
    })),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const createJobSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  address: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  assignedTechIds: z.array(z.string()).default([]),
  status: z.enum(["scheduled", "in_progress", "done", "cancelled"]).optional(),
});

const patchJobSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().min(1).optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  assignedTechIds: z.array(z.string()).optional(),
  status: z.enum(["scheduled", "in_progress", "done", "cancelled"]).optional(),
});

const noteSchema = z.object({
  text: z.string().min(1).max(4000),
});

router.get("/", requireAuth, async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
    return res.status(400).json({ error: "from and to query params (ISO dates) are required" });
  }

  const filter = { start: { $gte: from, $lte: to } };
  if (req.user.role === "tech") {
    filter.assignedTechIds = new mongoose.Types.ObjectId(req.user.id);
  }

  const jobs = await Job.find(filter)
    .sort({ start: 1 })
    .populate("assignedTechIds", "name email")
    .lean();

  return res.json(
    jobs.map((j) => ({
      ...serializeJob(j),
      assignedTechs: (j.assignedTechIds || []).map((t) => ({
        id: t._id.toString(),
        name: t.name,
        email: t.email,
      })),
    }))
  );
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  if (b.end <= b.start) return res.status(400).json({ error: "end must be after start" });

  const job = await Job.create({
    title: b.title,
    description: b.description ?? "",
    address: b.address,
    start: b.start,
    end: b.end,
    assignedTechIds: b.assignedTechIds.map((id) => new mongoose.Types.ObjectId(id)),
    status: b.status ?? "scheduled",
    createdBy: new mongoose.Types.ObjectId(req.user.id),
    seriesId: null,
  });
  const populated = await Job.findById(job._id).populate("assignedTechIds", "name email").lean();
  emitToCompany("job:created", { job: serializeJob(populated) });
  return res.status(201).json(serializeJob(populated));
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = patchJobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const scope = req.query.scope === "series" ? "series" : "occurrence";

  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (scope === "series" && job.seriesId) {
    const series = await JobSeries.findById(job.seriesId);
    if (!series) return res.status(404).json({ error: "Series not found" });

    const b = parsed.data;
    if (b.title != null) series.title = b.title;
    if (b.description != null) series.description = b.description;
    if (b.address != null) series.address = b.address;
    if (b.assignedTechIds != null) {
      series.assignedTechIds = b.assignedTechIds.map((id) => new mongoose.Types.ObjectId(id));
    }
    await series.save();
    await regenerateSeriesWindow(series._id);
    const jobs = await Job.find({ seriesId: series._id, start: { $gte: new Date() } })
      .sort({ start: 1 })
      .lean();
    for (const j of jobs) {
      emitToCompany("job:updated", { job: serializeJob(j) });
    }
    return res.json({ ok: true, scope: "series", seriesId: series._id.toString(), instancesUpdated: jobs.length });
  }

  const b = parsed.data;
  if (b.start != null && b.end != null && b.end <= b.start) {
    return res.status(400).json({ error: "end must be after start" });
  }
  if (b.start != null && b.end == null && job.end <= b.start) {
    return res.status(400).json({ error: "end must be after start" });
  }
  if (b.end != null && b.start == null && b.end <= job.start) {
    return res.status(400).json({ error: "end must be after start" });
  }

  if (b.title != null) job.title = b.title;
  if (b.description != null) job.description = b.description;
  if (b.address != null) job.address = b.address;
  if (b.start != null) job.start = b.start;
  if (b.end != null) job.end = b.end;
  if (b.assignedTechIds != null) {
    job.assignedTechIds = b.assignedTechIds.map((id) => new mongoose.Types.ObjectId(id));
  }
  if (b.status != null) job.status = b.status;
  await job.save();

  const populated = await Job.findById(job._id).populate("assignedTechIds", "name email").lean();
  emitToCompany("job:updated", { job: serializeJob(populated) });
  return res.json(serializeJob(populated));
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const id = job._id.toString();
  await job.deleteOne();
  emitToCompany("job:deleted", { jobId: id });
  return res.json({ ok: true });
});

router.post("/:id/notes", requireAuth, async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (req.user.role === "tech") {
    const assigned = job.assignedTechIds.some((id) => id.toString() === req.user.id);
    if (!assigned) return res.status(403).json({ error: "Forbidden" });
  }

  job.notes.push({
    text: parsed.data.text,
    authorId: new mongoose.Types.ObjectId(req.user.id),
    createdAt: new Date(),
  });
  await job.save();
  const last = job.notes[job.notes.length - 1];
  const note = {
    id: last._id.toString(),
    text: last.text,
    authorId: last.authorId.toString(),
    createdAt: last.createdAt,
  };
  emitToCompany("note:added", { jobId: job._id.toString(), note });
  return res.status(201).json(note);
});

export default router;
