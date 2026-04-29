import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

const userSockets = new Map();

/* =========================
   SOCKET.IO
========================= */
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("🔌 User connected");

  io.on("connection", (socket) => {
    socket.on("register-user", (userId) => {
      userSockets.set(userId, socket.id);
    });
  });

  socket.on("join-flight", (flightId) => {
    socket.join(`flight-${flightId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
});

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   AUTH MIDDLEWARE
========================= */
const requireAdmin = (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("🚀 API Running");
});

/* =========================
   FLIGHTS
========================= */
app.get("/flights", async (req, res) => {
  const result = await pool.query("SELECT * FROM flights");
  res.json(result.rows);
});

/* =========================
   SEATS
========================= */
app.get("/seat/:flightId", async (req, res) => {
  const { flightId } = req.params;

  const result = await pool.query(
    "SELECT * FROM seats WHERE flight_id=$1",
    [flightId]
  );

  res.json(result.rows);
});

/* =========================
   SEAT LOCK (REAL-TIME)
========================= */
app.post("/seat/lock", async (req, res) => {
  const { seatId, flightId } = req.body;

  const seat = await pool.query(
    "SELECT * FROM seats WHERE id=$1",
    [seatId]
  );

  if (!seat.rows.length || seat.rows[0].status !== "available") {
    return res.status(400).json({ error: "Seat already taken" });
  }

  await pool.query(
    "UPDATE seats SET status='locked' WHERE id=$1",
    [seatId]
  );

  // 🔥 broadcast
  io.to(`flight-${flightId}`).emit("seat-updated", {
    seatId,
    status: "locked",
  });

  // ⏱ auto release (5 min)
  setTimeout(async () => {
    const check = await pool.query(
      "SELECT status FROM seats WHERE id=$1",
      [seatId]
    );

    if (check.rows[0].status === "locked") {
      await pool.query(
        "UPDATE seats SET status='available' WHERE id=$1",
        [seatId]
      );

      io.to(`flight-${flightId}`).emit("seat-updated", {
        seatId,
        status: "available",
      });
    }
  }, 300000);

  res.json({ success: true });
});

/* =========================
   BOOKING
========================= */
app.post("/booking", async (req, res) => {
  const { flightId, seats } = req.body;

  const result = await pool.query(
    `INSERT INTO bookings (flight_id, seat, status)
     VALUES ($1, $2, 'PENDING')
     RETURNING *`,
    [flightId, seats.join(",")]
  );

  res.json(result.rows[0]);
});

/* =========================
   PAYMENT
========================= */
app.post("/payment", async (req, res) => {
  const { bookingId, amount, slip } = req.body;

  await pool.query(
    `INSERT INTO payments (booking_id, amount, slip, status)
     VALUES ($1, $2, $3, 'PENDING')`,
    [bookingId, amount, slip]
  );

  res.json({ success: true });
});

/* =========================
   UPLOAD SLIP
========================= */
app.post("/payment/upload-slip", async (req, res) => {
  // (multer integration here later)
  res.json({ success: true });
});

/* =========================
   TICKET STATUS
========================= */
app.get("/ticket/:bookingId", async (req, res) => {
  const { bookingId } = req.params;

  const result = await pool.query(
    "SELECT status, ticket_code FROM bookings WHERE id=$1",
    [bookingId]
  );

  if (!result.rows.length) {
    return res.json({ status: "NOT_FOUND" });
  }

  res.json(result.rows[0]);
});

/* =========================
   QR VERIFY (AIRPORT)
========================= */
app.post("/boarding/verify", async (req, res) => {
  try {
    const { qr } = req.body;

    const bookingId = qr.split("|")[0].split(":")[1];

    const result = await pool.query(
      "SELECT * FROM bookings WHERE id=$1",
      [bookingId]
    );

    if (!result.rows.length) {
      return res.json({ valid: false });
    }

    const booking = result.rows[0];

    if (booking.status !== "CONFIRMED") {
      return res.json({ valid: false });
    }

    return res.json({
      valid: true,
      seat: booking.seat,
    });
  } catch {
    res.json({ valid: false });
  }
});

/* =========================
   ADMIN
========================= */
app.get("/admin/bookings", requireAdmin, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM bookings ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

app.post("/admin/approve-payment", requireAdmin, async (req, res) => {
  const { paymentId, userId } = req.body;

  await pool.query(
    "UPDATE payments SET status='APPROVED' WHERE id=$1",
    [paymentId]
  );
  
  const socketId = userSockets.get(userId);

  if (socketId) {
    io.to(socketId).emit("payment-approved", {
      message: "Payment approved",
    });
  }

  res.json({ success: true });
});

app.post("/admin/generate-ticket", requireAdmin, async (req, res) => {
  const { bookingId } = req.body;

  const code = `TKT-${Date.now()}`;

  await pool.query(
    "UPDATE bookings SET ticket_code=$1, status='CONFIRMED' WHERE id=$2",
    [code, bookingId]
  );

  res.json({ code });
});

/* =========================
   STATIC FILES
========================= */
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

/* =========================
   ERROR HANDLER
========================= */
app.use((err: any, req: any, res: any, next: any) => {
  console.error("❌ ERROR:", err);
  res.status(500).json({
    message: "Internal Server Error",
  });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server + Socket running on ${PORT}`);
});