// payment.controller.ts
import { Request, Response } from "express";
import { createPaymentIntent } from "./payment.service.js";

export const createPayment = async (req: Request, res: Response) => {
  const { amount, bookingId } = req.body;

  const intent = await createPaymentIntent(amount, bookingId);

  res.json({
    clientSecret: intent.client_secret,
  });
};