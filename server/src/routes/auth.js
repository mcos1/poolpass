import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { username, password } = parsed.data;
  
  const user = await User.findOne({
    $or: [
      { email: username.toLowerCase() },
      { name: username }
    ]
  });
  
  if (!user || !user.active) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = signAccessToken({
    typ: "access",
    sub: user._id.toString(),
    role: user.role,
  });
  const refreshToken = signRefreshToken({
    typ: "refresh",
    sub: user._id.toString(),
  });

  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save();

  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/auth",
  });

  return res.json({
    accessToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: "Missing refresh token" });
  }
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
  if (payload.typ !== "refresh") {
    return res.status(401).json({ error: "Invalid token type" });
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (
    !user.refreshTokenHash ||
    user.refreshTokenHash !== hashToken(refreshToken) ||
    !user.refreshTokenExpires ||
    user.refreshTokenExpires < new Date()
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const accessToken = signAccessToken({
    typ: "access",
    sub: user._id.toString(),
    role: user.role,
  });

  const newRefresh = signRefreshToken({
    typ: "refresh",
    sub: user._id.toString(),
  });
  user.refreshTokenHash = hashToken(newRefresh);
  user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save();

  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", newRefresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/auth",
  });

  return res.json({
    accessToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

router.post("/logout", requireAuth, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, {
    $unset: { refreshTokenHash: 1, refreshTokenExpires: 1 },
  });
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("refreshToken", { path: "/auth", httpOnly: true, secure: isProd, sameSite: "lax" });
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  return res.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

export default router;
