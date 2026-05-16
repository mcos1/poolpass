import mongoose from "mongoose";

const recurrenceSchema = new mongoose.Schema(
  {
    frequency: { type: String, enum: ["weekly"], required: true },
    interval: { type: Number, default: 1, min: 1 },
    byWeekday: [{ type: Number, min: 0, max: 6 }],
    until: { type: Date, default: null },
  },
  { _id: false }
);

const jobSeriesSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    address: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, default: 60, min: 15, max: 1440 },
    startTimeHour: { type: Number, default: 9, min: 0, max: 23 },
    startTimeMinute: { type: Number, default: 0, min: 0, max: 59 },
    assignedTechIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    recurrence: { type: recurrenceSchema, required: true },
    windowGeneratedUntil: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const JobSeries =
  mongoose.models.JobSeries || mongoose.model("JobSeries", jobSeriesSchema);
