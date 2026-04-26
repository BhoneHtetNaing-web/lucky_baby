// booking.controller.ts
import { Request, Response } from "express";
import { createBooking } from "./booking.service.js";
import { pool } from "../../db.js";

export const bookSeats = async (req: any, res: Response) => {
  try {
    const { flightId, seatIds } = req.body;
    const userId = req.user.userId;

    const booking = await createBooking(userId, flightId, seatIds);

    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const checkIn = async (req: Request, res: Response) => {
  const { qr } = req.body;

  const result = await pool.query(
    "SELECT * FROM bookings WHERE qr_code=$1",
    [qr]
  );

  if (result.rows.length === 0) {
    return res.json({ success: false, message: "Invalid ticket" });
  }

  await pool.query(
    "UPDATE bookings SET status='CHECKED_IN' WHERE qr_code=$1",
    [qr]
  );

  res.json({ success: true });
};