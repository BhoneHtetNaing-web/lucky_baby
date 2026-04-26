// src/server.ts
import express from "express";
import http from "http";
import { initFlightTracking } from "./ws/flightTracking.js";
import { initMultiFlightTracking } from "./ws/multiFlightTracking.js";
import { sendOTP, verify } from "./modules/auth/auth.controller.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { getSeats } from "./modules/seat/seat.controller.js";
import { bookSeats, checkIn } from "./modules/booking/booking.controller.js";
import { createPaymentController, uploadSlip, approveBookingController } from "./modules/payment/payment.controller.js";
import { releaseExpiredSeats } from "./modules/seat/seat.cleanup.js";
import { pool } from "./db.js";
import { upload } from "./modules/payment/upload.js";
import cors from "cors";

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cors({
  origin: "*",
}));

// attach websocket
initFlightTracking(server);
initMultiFlightTracking(server);

server.listen(4000, () => {
  console.log("Server running on port 4000");
});

app.get("/me", authMiddleware, (req: any, res) => {
  res.json({ user: req.user });
});

app.post("/auth/request-otp", sendOTP);
app.post("/auth/verify-otp", verify);
app.get("/flights/:flightId/seats", getSeats);
app.get("/flights/:id/seats", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT * FROM seats WHERE flight_id=$1 ORDER BY id`,
    [id],
  );

  res.json(result.rows);
});
// HOLD seats (5 min lock)
app.post("/seats/hold", async (req, res) => {
  const { seatIds } = req.body;

  await pool.query(
    `
    UPDATE seats
    SET status='HELD',
        hold_expires_at = NOW() + INTERVAL '5 minutes'
    WHERE id = ANY($1)
    `,
    [seatIds],
  );

  res.json({ success: true });
});
// CREATE booking
app.post("/booking", async (req, res) => {
  const { userId, flightId, seatIds, totalPrice } = req.body;

  const booking = await pool.query(
    `
    INSERT INTO bookings (user_id, flight_id, total_price, status)
    VALUES ($1,$2,$3,'PENDING')
    RETURNING *
    `,
    [userId, flightId, totalPrice],
  );

  const bookingId = booking.rows[0].id;

  for (let seatId of seatIds) {
    await pool.query(
      `
      INSERT INTO booking_seats (booking_id, seat_id)
      VALUES ($1,$2)
      `,
      [bookingId, seatId],
    );
  }

  res.json(booking.rows[0]);
});
app.post("/bookings/create", authMiddleware, bookSeats);
app.get("/bookings/user/:userId", async (req, res) => {
  const { userId } = req.params;

  const result = await pool.query(
    `
    SELECT b.*, f.from_city, f.to_city, f.departure_time
    FROM bookings b
    JOIN flights f ON f.id = b.flight_id
    WHERE b.user_id = $1
    ORDER BY b.created_at DESC
    `,
    [userId],
  );

  res.json(result.rows);
});
app.post("/payment/create", authMiddleware, createPaymentController);
app.post("/payment/upload-slip", upload.single("file"), uploadSlip);
app.post("/admin/approve-booking", approveBookingController);
app.post("/checkin", checkIn);

setInterval(() => {
  releaseExpiredSeats();
}, 60000);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
