import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { connectDb } from "./db.js";
import { setIO } from "./io.js";
import { verifyAccessToken } from "./utils/tokens.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import jobsRoutes from "./routes/jobs.js";
import jobSeriesRoutes from "./routes/jobSeries.js";

const app = express();
const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/auth", authLimiter, authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/job-series", jobSeriesRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = verifyAccessToken(token);
    if (decoded.typ !== "access") return next(new Error("Unauthorized"));
    socket.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.join("company");
});

setIO(io);

const port = Number(process.env.PORT) || 5000;

await connectDb(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pool_scheduler");

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
