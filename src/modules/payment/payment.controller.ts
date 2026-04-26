import { Request, Response } from "express";
import {
  createPayment,
  savePaymentSlip,
  approveBooking,
} from "./payment.service.js";
import { pool } from "../../db.js";

// 👉 create payment (set pending)
export const createPaymentController = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;

    const result = await createPayment(bookingId);

    res.json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Unknown error occurred" });
    }
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

    const result = await savePaymentSlip(bookingId, file.path);

    res.json({
      message: "Uploaded",
      data: result,
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};

// 👉 admin approve
export const approveBookingController = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;

    const result = await approveBooking(bookingId);

    res.json({
      message: "Booking confirmed 🎟️",
      data: result,
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};

export const approvePayment = async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. update payment
  await pool.query(
    "UPDATE payments SET status='APPROVED' WHERE id=$1",
    [id]
  );

  // 2. confirm booking
  await pool.query(
    "UPDATE bookings SET status='CONFIRMED' WHERE id = (SELECT booking_id FROM payments WHERE id=$1)",
    [id]
  );

  // 3. generate QR
  const qr = `BOOKING-${id}-${Date.now()}`;

  await pool.query(
    "UPDATE bookings SET qr_code=$1 WHERE id = (SELECT booking_id FROM payments WHERE id=$2)",
    [qr, id]
  );

  res.json({ success: true });
};
