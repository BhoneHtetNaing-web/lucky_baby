import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { pool } from "./db.js";

dotenv.config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: "*", // ⚠️ dev only
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   ROUTES IMPORT
========================= */
import authRoutes from "./modules/auth/auth.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import ticketRoutes from "./modules/ticket/ticket.routes.js";
import checkinRoutes from "./modules/checkin/checkin.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import seatRoutes from "./modules/seat/seat.routes.js";
import { getAutoReply, aiChat } from "./modules/chat/chat.controller.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

/* =========================
   BASE ROUTES
========================= */
app.get("/", (req, res) => {
  res.send("🚀 Lucky Treasure API Running");
});

/* =========================
   AUTH
========================= */
app.use("/auth", authRoutes);

app.get("/me", authMiddleware, async (req: any, res) => {
  res.json({
    message: "Authorized user",
    user: req.user,
  });
});

/* =========================
   MAIN MODULES
========================= */
app.use("/booking", bookingRoutes);
app.use("/seat", seatRoutes);
app.post("/seat/lock", async (req, res) => {
  const { seatId, userId } = req.body;

  try {
    const result = await pool.query(
      `UPDATE seats
       SET status='locked',
           locked_by=$1,
           locked_at=NOW()
       WHERE id=$2
       AND (status='available'
            OR (status='locked' AND locked_at < NOW() - INTERVAL '2 minutes'))
       RETURNING *`,
      [userId, seatId]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, message: "Seat already taken" });
    }

    res.json({ success: true, seat: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Lock failed" });
  }
});
app.post("/seat/unlock", async (req, res) => {
  const { seatId, userId } = req.body;

  await pool.query(
    `UPDATE seats
     SET status='available',
         locked_by=NULL,
         locked_at=NULL
     WHERE id=$1 AND locked_by=$2`,
    [seatId, userId]
  );

  res.json({ success: true });
});
app.post("/seat/book", async (req, res) => {
  const { seatId, userId } = req.body;

  const result = await pool.query(
    `UPDATE seats
     SET status='booked'
     WHERE id=$1 AND locked_by=$2
     RETURNING *`,
    [seatId, userId]
  );

  if (result.rowCount === 0) {
    return res.json({ success: false });
  }

  res.json({ success: true });
});
app.use("/payment", paymentRoutes);
app.use("/ticket", ticketRoutes);
app.use("/checkin", checkinRoutes);

/* =========================
   ADMIN (IMPORTANT)
========================= */
app.use("/admin", adminRoutes);

/* =========================
   CHATBOT
========================= */
app.post("/ai-chat", aiChat);

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  const autoReply = getAutoReply(message);

  await pool.query(
    `INSERT INTO messages (message, reply, status, role)
     VALUES ($1, $2, 'user', 'auto')`,
    [message, autoReply]
  );

  res.json({ message, reply: autoReply });
});

app.post("/admin/reply", async (req, res) => {
  const { id, reply } = req.body;

  await pool.query(
    `UPDATE messages
     SET reply=$1, status='admin'
     WHERE id=$2`,
    [reply, id]
  );

  res.json({ success: true });
});

/* =========================
   FLIGHTS
========================= */
app.get("/airlines", async (req, res) => {
  const result = await pool.query("SELECT * FROM airlines");
  res.json(result.rows);
});
app.get("/flights/:airlineId", async (req, res) => {
  const { airlineId } = req.params;

  const result = await pool.query(
    "SELECT * FROM flights WHERE airline_id=$1",
    [airlineId]
  );

  res.json(result.rows);
});
app.get("/flights", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM flights");
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch flights" });
  }
});

app.post("/flights", async (req, res) => {
  const { from, to, price, departure_time } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO flights (from_city, to_city, price, departure_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [from, to, price, departure_time]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Create flight failed" });
  }
});

/* =========================
   VISA
========================= */
app.post("/visa", async (req, res) => {
  const { name, passport, country, travelDate } = req.body;

  await pool.query(
    `INSERT INTO visa_requests (name, passport, country, travel_date, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [name, passport, country, travelDate]
  );

  res.json({ message: "Visa created" });
});

/* =========================
   HISTORY
========================= */
app.get("/history", async (req, res) => {
  const flights = await pool.query(`
    SELECT id, 'flight' as type,
    'Flight Booking' as title,
    status, created_at
    FROM bookings
    WHERE status = 'CONFIRMED'
  `);

  const visas = await pool.query(`
    SELECT id, 'visa' as type,
    country as title,
    status, created_at
    FROM visa_requests
    WHERE status = 'approved'
  `);

  const combined = [...flights.rows, ...visas.rows];

  combined.sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  res.json(combined);
});

/* =========================
   BOARDING QR VERIFY
========================= */
app.post("/boarding/verify", async (req, res) => {
  const { qr } = req.body;

  try {
    const bookingId = qr.split("|")[0].split(":")[1];

    const result = await pool.query(
      "SELECT * FROM bookings WHERE id=$1",
      [bookingId]
    );

    if (result.rows.length === 0) {
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
   STATIC FILES
========================= */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* =========================
   ERROR HANDLER (LAST)
========================= */
app.use((err:any, req: any, res: any, next: any) => {
  console.error("❌ ERROR:", err);
  res.status(500).json({
    message: "Internal Server Error",
  });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});