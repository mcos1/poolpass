import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "tech"], required: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);
userSchema.index({ name: 1 });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
