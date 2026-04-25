// webhook.ts
import Stripe from "stripe";
import { pool } from "../../db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const stripeWebhook = async (req: any, res: any) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return res.status(400).send("Webhook error");
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const bookingId = paymentIntent.metadata.bookingId;

    // webhook.ts
    await pool.query(
      `UPDATE seats
   SET status='BOOKED',
       hold_expires_at=NULL
   WHERE id IN (
     SELECT seat_id FROM booking_seats WHERE booking_id=$1)`,
      [bookingId],
    );
    // ✅ mark booking confirmed
    await pool.query(`UPDATE bookings SET status='CONFIRMED' WHERE id=$1`, [
      bookingId,
    ]);
  }

  res.json({ received: true });
};
