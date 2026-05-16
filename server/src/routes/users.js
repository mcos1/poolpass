import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const createUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["admin", "tech"]).default("tech"),
}).refine((data) => {
  if (data.role === "admin" && !data.email) {
    return false;
  }
  return true;
}, { message: "Email is required for admins" });

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await User.find({}).select("-passwordHash -refreshTokenHash").sort({ name: 1 }).lean();
  return res.json(
    users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
    }))
  );
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name, role } = parsed.data;
  
  if (email) {
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already in use" });
  }

  const nameExists = await User.findOne({ name });
  if (nameExists) return res.status(409).json({ error: "Username already in use" });
  
  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await User.create({
      ...(email ? { email: email.toLowerCase() } : {}),
      passwordHash,
      name,
      role,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Email or username already in use" });
    }
    throw err;
  }

  return res.status(201).json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

export default router;
