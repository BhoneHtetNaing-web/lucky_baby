// src/modules/payment/payment.service.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
});

export const createPaymentIntent = async (
  amount: number,
  bookingId: number
) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // cents
    currency: "usd",
    metadata: { bookingId },
  });

  return paymentIntent;
};