import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// ROUTES
import authRoutes from "./modules/auth/auth.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import ticketRoutes from "./modules/ticket/ticket.routes.js";
import checkinRoutes from "./modules/checkin/checkin.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import seatRoutes from "./modules/seat/seat.routes.js";

dotenv.config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: "*", // 👉 production မှာ app domain only ထည့်
}));

app.use(express.json());
app.use("/auth", authRoutes);
app.use(express.urlencoded({ extended: true }));

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