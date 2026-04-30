import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import authRoutes from "./modules/auth/auth.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import ticketRoutes from "./modules/ticket/ticket.routes.js";
import seatRoutes from "./modules/seat/seat.routes.js";
import tourRoutes from "./modules/tour/tour.routes.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

export const userSockets = new Map();

/* ================= SOCKET ================= */
export const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("🔌 User connected");

  socket.on("register-user", (userId) => {
    userSockets.set(userId, socket.id);
  });

  socket.on("join-flight", (flightId) => {
    socket.join(`flight-${flightId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
});

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* ================= ROUTES ================= */
app.use("/auth", authRoutes);
app.use("/tours", tourRoutes);
app.use("/booking", bookingRoutes);
app.use("/payment", paymentRoutes);
app.use("/admin", adminRoutes);
app.use("/ticket", ticketRoutes);
app.use("/seat", seatRoutes);

/* ================= START ================= */
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});