// src/server.ts
import express from "express";
import http from "http";
import { initFlightTracking } from "./ws/flightTracking.js";
import { initMultiFlightTracking } from "./ws/multiFlightTracking.js";
import { sendOTP, verify } from "./modules/auth/auth.controller.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { getSeats } from "./modules/seat/seat.controller.js";
import { bookSeats } from "./modules/booking/booking.controller.js";
import { createPayment } from "./modules/payment/payment.controller.js";
import { stripeWebhook } from "./modules/payment/webhook.js";
import { releaseExpiredSeats } from "./modules/seat/seat.cleanup.js";
import { pool } from "./db.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
});

const app = express();
const server = http.createServer(app);
app.use(express.json());

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
app.post("/bookings", authMiddleware, bookSeats);
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
app.post("/payment/create-intent", async (req, res) => {
  const { bookingId } = req.body;

  // 1. get booking
  const booking = await pool.query(`SELECT * FROM bookings WHERE id=$1`, [
    bookingId,
  ]);

  const amount = booking.rows[0].total_price;

  // 2. create stripe payment
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency: "usd",
    metadata: {
      bookingId: bookingId.toString(),
    },
  });

  res.json({
    clientSecret: paymentIntent.client_secret,
  });
});
app.post("/payment", authMiddleware, createPayment);
app.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const event = req.body;

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    const bookingId = paymentIntent.metadata.bookingId;
    Stripe;

    // 1. CONFIRM BOOKING
    await pool.query(`UPDATE bookings SET status='CONFIRMED' WHERE id=$1`, [
      bookingId,
    ]);

    // 2. BOOK SEATS
    await pool.query(
      `
        UPDATE seats
        SET status='BOOKED'
        WHERE id IN (
          SELECT seat_id FROM booking_seats WHERE booking_id=$1
        )
        `,
      [bookingId],
    );
  }

  res.json({ received: true });
});
app.post("/checkin", async (req, res) => {
  const { bookingId } = req.body;

  await pool.query(
    `
    UPDATE bookings
    SET status = 'CHECKED_IN'
    WHERE id = $1
    `,
    [bookingId]
  );

  res.json({ success: true });
});

setInterval(() => {
  releaseExpiredSeats();
}, 60000);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
