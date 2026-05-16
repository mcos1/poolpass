import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { JobSeries } from "../models/JobSeries.js";
import { Job } from "../models/Job.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { materializeNewSeries, regenerateSeriesWindow } from "../utils/seriesMaterialize.js";
import { emitToCompany } from "../io.js";

const router = Router();

const recurrenceSchema = z.object({
  frequency: z.literal("weekly"),
  interval: z.number().min(1).default(1),
  byWeekday: z.array(z.number().min(0).max(6)).min(1),
  until: z.coerce.date().nullable().optional(),
});

const createSeriesSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  address: z.string().min(1),
  durationMinutes: z.number().min(15).max(1440).default(60),
  startTimeHour: z.number().min(0).max(23).default(9),
  startTimeMinute: z.number().min(0).max(59).default(0),
  assignedTechIds: z.array(z.string()).default([]),
  recurrence: recurrenceSchema,
});

const patchSeriesSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().min(1).optional(),
  durationMinutes: z.number().min(15).max(1440).optional(),
  startTimeHour: z.number().min(0).max(23).optional(),
  startTimeMinute: z.number().min(0).max(59).optional(),
  assignedTechIds: z.array(z.string()).optional(),
  recurrence: recurrenceSchema.optional(),
  regenerateInstances: z.boolean().optional(),
});

function serializeSeries(s) {
  const o = s.toObject ? s.toObject() : s;
  return {
    id: o._id.toString(),
    title: o.title,
    description: o.description,
    address: o.address,
    durationMinutes: o.durationMinutes,
    startTimeHour: o.startTimeHour,
    startTimeMinute: o.startTimeMinute,
    assignedTechIds: (o.assignedTechIds || []).map((id) => id.toString()),
    recurrence: o.recurrence,
    windowGeneratedUntil: o.windowGeneratedUntil,
    createdBy: o.createdBy?.toString(),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const list = await JobSeries.find({}).sort({ updatedAt: -1 }).lean();
  return res.json(list.map(serializeSeries));
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createSeriesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;

  const series = await JobSeries.create({
    title: b.title,
    description: b.description ?? "",
    address: b.address,
    durationMinutes: b.durationMinutes,
    startTimeHour: b.startTimeHour,
    startTimeMinute: b.startTimeMinute,
    assignedTechIds: b.assignedTechIds.map((id) => new mongoose.Types.ObjectId(id)),
    recurrence: b.recurrence,
    createdBy: new mongoose.Types.ObjectId(req.user.id),
  });

  await materializeNewSeries(series);

  const jobs = await Job.find({ seriesId: series._id }).sort({ start: 1 }).lean();
  for (const j of jobs) {
    emitToCompany("job:created", {
      job: {
        id: j._id.toString(),
        title: j.title,
        description: j.description,
        address: j.address,
        start: j.start,
        end: j.end,
        assignedTechIds: (j.assignedTechIds || []).map((id) => id.toString()),
        status: j.status,
        createdBy: j.createdBy?.toString(),
        seriesId: j.seriesId?.toString() ?? null,
        notes: [],
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      },
    });
  }

  return res.status(201).json(serializeSeries(series));
});

router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const s = await JobSeries.findById(req.params.id).lean();
  if (!s) return res.status(404).json({ error: "Not found" });
  return res.json(serializeSeries(s));
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = patchSeriesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const series = await JobSeries.findById(req.params.id);
  if (!series) return res.status(404).json({ error: "Not found" });

  const b = parsed.data;
  if (b.title != null) series.title = b.title;
  if (b.description != null) series.description = b.description;
  if (b.address != null) series.address = b.address;
  if (b.durationMinutes != null) series.durationMinutes = b.durationMinutes;
  if (b.startTimeHour != null) series.startTimeHour = b.startTimeHour;
  if (b.startTimeMinute != null) series.startTimeMinute = b.startTimeMinute;
  if (b.assignedTechIds != null) {
    series.assignedTechIds = b.assignedTechIds.map((id) => new mongoose.Types.ObjectId(id));
  }
  if (b.recurrence != null) series.recurrence = b.recurrence;
  await series.save();

  if (b.regenerateInstances !== false) {
    await regenerateSeriesWindow(series._id);
    const jobs = await Job.find({ seriesId: series._id, start: { $gte: new Date() } })
      .sort({ start: 1 })
      .lean();
    for (const j of jobs) {
      emitToCompany("job:updated", {
        job: {
          id: j._id.toString(),
          title: j.title,
          description: j.description,
          address: j.address,
          start: j.start,
          end: j.end,
          assignedTechIds: (j.assignedTechIds || []).map((id) => id.toString()),
          status: j.status,
          createdBy: j.createdBy?.toString(),
          seriesId: j.seriesId?.toString() ?? null,
          notes: (j.notes || []).map((n) => ({
            id: n._id.toString(),
            text: n.text,
            authorId: n.authorId.toString(),
            createdAt: n.createdAt,
          })),
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
        },
      });
    }
  }

  return res.json(serializeSeries(series));
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const series = await JobSeries.findById(req.params.id);
  if (!series) return res.status(404).json({ error: "Not found" });
  const jobs = await Job.find({ seriesId: series._id }).select("_id").lean();
  await Job.deleteMany({ seriesId: series._id });
  await series.deleteOne();
  for (const j of jobs) {
    emitToCompany("job:deleted", { jobId: j._id.toString() });
  }
  return res.json({ ok: true });
});

export default router;
