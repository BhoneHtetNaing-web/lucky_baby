import { Request, Response } from "express";
import {
  createPayment,
  savePaymentSlip,
  approveBooking,
} from "./payment.service.js";

// 👉 create payment (set pending)
export const createPaymentController = async (
  req: Request,
  res: Response
) => {
  try {
    const { bookingId } = req.body;

    const result = await createPayment(bookingId);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 👉 upload screenshot
export const uploadSlip = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await savePaymentSlip(
      bookingId,
      file.path
    );

    res.json({
      message: "Uploaded",
      data: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 👉 admin approve
export const approveBookingController = async (
  req: Request,
  res: Response
) => {
  try {
    const { bookingId } = req.body;

    const result = await approveBooking(bookingId);

    res.json({
      message: "Booking confirmed 🎟️",
      data: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};