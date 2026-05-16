import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 4000, trim: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    address: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    assignedTechIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "done", "cancelled"],
      default: "scheduled",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    seriesId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSeries", default: null },
    notes: [noteSchema],
  },
  { timestamps: true }
);

jobSchema.index({ start: 1, assignedTechIds: 1 });
jobSchema.index({ assignedTechIds: 1, start: 1 });
jobSchema.index({ seriesId: 1, start: 1 });

export const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);
