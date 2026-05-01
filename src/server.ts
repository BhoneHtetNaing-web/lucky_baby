import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { pool } from "./db.js";

// AUTH
import { requireAdmin } from "./middleware/auth.js";

// ROUTES
import authRoutes from "./modules/auth/auth.routes.js";
import flightRoutes from "./modules/flight/flight.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import ticketRoutes from "./modules/ticket/ticket.routes.js";
import seatRoutes from "./modules/seat/seat.routes.js";
import tourRoutes from "./modules/tour/tour.routes.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

/* =========================
   SOCKET STORAGE
========================= */
export const userSockets = new Map();

/* =========================
   SOCKET.IO (REALTIME CORE)
========================= */
export const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("🔌 USER CONNECTED:", socket.id);

  // map user → socket
  socket.on("register-user", (userId) => {
    userSockets.set(userId, socket.id);
  });

  // flight room
  socket.on("join-flight", (flightId) => {
    socket.join(`flight-${flightId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ USER DISCONNECTED");
  });
});

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   ROUTES (CORE SYSTEM)
========================= */

// AUTH
app.use("/auth", authRoutes);

// USER SYSTEM
app.use("/booking", bookingRoutes);
app.use("/payment", paymentRoutes);
app.use("/ticket", ticketRoutes);
app.use("/seat", seatRoutes);
app.use("/tours", tourRoutes);
app.use("/flights", flightRoutes);

// ADMIN SYSTEM (MOBILE ADMIN APP)
app.use("/admin", adminRoutes);

/* =========================
   ADMIN CONTROL (DIRECT APIs)
========================= */

// ❌ cancel booking
app.post("/admin/cancel-booking", requireAdmin, async (req, res) => {
  const { bookingId } = req.body;

  await pool.query(
    "UPDATE bookings SET status='CANCELLED' WHERE id=$1",
    [bookingId]
  );

  res.json({ success: true });
});

// 💳 approve payment + notify user
app.post("/admin/approve-payment", requireAdmin, async (req, res) => {
  const { paymentId, bookingId, userId } = req.body;

  await pool.query(
    "UPDATE payments SET status='APPROVED' WHERE id=$1",
    [paymentId]
  );

  await pool.query(
    "UPDATE bookings SET status='CONFIRMED' WHERE id=(SELECT booking_id FROM payments WHERE id=$1)",
    [bookingId]
  )

  const socketId = userSockets.get(userId);

  if (socketId) {
    io.to(socketId).emit("payment-approved", {
      bookingId,
    });
  }

  res.json({ success: true });
});

// 🎟 generate ticket
app.post("/admin/generate-ticket", requireAdmin, async (req, res) => {
  const { bookingId } = req.body;

  const ticketCode = `TKT-${Date.now()}`;

  await pool.query(
    "UPDATE bookings SET ticket_code=$1, status='CONFIRMED' WHERE id=$2",
    [ticketCode, bookingId]
  );

  res.json({ ticketCode });
});

/* =========================
   HISTORY (USER + TOUR + FLIGHT)
========================= */
app.get("/history", async (req, res) => {
    const flights = await pool.query(`
      SELECT id, 'flight' as type,
      'Flight Booking' as title,
      status,
      created_at
      FROM bookings
    `);

    const tours = await pool.query(`
      SELECT id, 'tour' as type,
      name as title,
      status,
      created_at
      FROM tours_bookings
    `);

    const combined = [...flights.rows, ...tours.rows];

    combined.sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    res.json(combined);
  }
);

/* =========================
   ADMIN ANALYTICS
========================= */
app.get("/admin/stats", requireAdmin, async (req, res) => {
  const revenue = await pool.query(`
    SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='APPROVED'
  `);

  const bookings = await pool.query(`SELECT COUNT(*) FROM bookings`);
  const tours = await pool.query(`SELECT COUNT(*) FROM tour_bookings`);

  res.json({
    revenue: revenue.rows[0].coalesce,
    bookings: bookings.rows[0].count,
    tours: tours.rows[0].count,
  });
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("🚀 Lucky Treasure FULL SYSTEM RUNNING");
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 SERVER + SOCKET RUNNING ON ${PORT}`);
});