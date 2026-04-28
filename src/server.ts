import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { pool } from "./db.js";

dotenv.config();

// ROUTES
import authRoutes from "./modules/auth/auth.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import ticketRoutes from "./modules/ticket/ticket.routes.js";
import checkinRoutes from "./modules/checkin/checkin.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import seatRoutes from "./modules/seat/seat.routes.js";
import { getAutoReply, aiChat } from "./modules/chat/chat.controller.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: "*", // 👉 production မှာ app domain only ထည့်
}));


app.use("/auth", authRoutes);

/* ======================
  CHAT-BOT
======================= */
app.post("/ai-chat", aiChat);
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  const autoReply = getAutoReply(message);

  await pool.query(
    `INSERT INTO messages (message, reply, status, role)
     VALUES ($1, $2, 'user', 'auto') RETURNING *`,
    [message]
  );

  res.json({
    message,
    reply: autoReply,
  });
});

/* =========================
  ADMIN / REPLY
========================== */
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
========================== */
app.get("/flights", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM flights");

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch flights" });
  }
});

/* ========================
  POST FLIGHTS (ADMIN USE)
========================= */
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
  } catch (err) {
    res.status(500).json({ error: "Create flight failed" });
  }
});

/* =========================
  VISA API
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
  HISTORY API
========================= */
app.get("/history", async (req, res) => {
  const flights = await pool.query(`
    SELECT id, 'flight' as type,
    'Flight Booking' as title,
    status,
    created_at
    FROM bookings
    WHERE status = 'confirmed'
  `);

  const visas = await pool.query(`
    SELECT id, 'visa' as type,
    country as title,
    status,
    created_at
    FROM visa_requests
    WHERE status = 'approved'
  `);

  const combined = [...flights.rows, ...visas.rows];

  combined.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  res.json(combined);
});

/* =========================
   STATIC FILE (UPLOADS)
========================= */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* =========================
   ROUTES
========================= */

// Health check
app.get("/", (req, res) => {
  res.send("🚀 Lucky Treasure API Running");
});

// BOOKING + SEAT
app.use("/booking", bookingRoutes);
app.use("/seat", seatRoutes);
// Payment (user upload slip)
app.use("/payment", paymentRoutes);

// Admin approve
app.use("/admin", adminRoutes);

// Ticket
app.use("/ticket", ticketRoutes);

// checkin
app.use("/checkin", checkinRoutes);
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});