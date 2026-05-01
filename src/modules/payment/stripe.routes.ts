import express from "express";
import Stripe from "stripe";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// CREATE CHECKOUT SESSION
router.post("/create-checkout", async (req, res) => {
  const { amount } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Flight Booking",
          },
          unit_amount: amount * 100,
        },
        quantity: 1,
      },
    ],
    success_url: "luckybaby-production.up.railway.app://payment-success?bookingId={BOOKING_ID}",
    cancel_url: "luckybaby-production.up.railway.app://payment-cancel",
  });

  res.json({ url: session.url });
});

export default router;