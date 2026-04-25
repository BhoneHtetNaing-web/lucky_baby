// src/server.ts
import express from "express";
import { sendOTP, verify } from "./modules/auth/auth.controller.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { getSeats } from "./modules/seat/seat.controller.js";
import { bookSeats } from "./modules/booking/booking.controller.js";
import { createPayment } from "./modules/payment/payment.controller.js";
import { stripeWebhook } from "./modules/payment/webhook.js";
import { releaseExpiredSeats } from "./modules/seat/seat.cleanup.js";

const app = express();
app.use(express.json());

app.get("/me", authMiddleware, (req: any, res) => {
    res.json({ user: req.user });
});

app.post("/auth/request-otp", sendOTP);
app.post("/auth/verify-otp", verify);
app.get("/flights/:flightId/seats", getSeats);
app.post("/booking", authMiddleware, bookSeats);
app.post("/payment", authMiddleware, createPayment);
app.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const event = req.body;

    if (event.type === "payment_intent.succeeded") {
      console.log("Payment Success ✅");

      // 👉 update booking = CONFIRMED
    }

    res.json({ received: true });
  }
);

setInterval(() => {
    releaseExpiredSeats();
}, 60000);

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});