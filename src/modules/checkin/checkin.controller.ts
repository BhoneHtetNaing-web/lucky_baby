import { pool } from "../../db.js";
import { Request, Response } from "express";

export const checkIn = async (req: any, res: any) => {
  const { qr } = req.body;

  // 🔹 find ticket
  const ticket = await pool.query(
    "SELECT * FROM tickets WHERE qr_code=$1",
    [qr]
  );

  if (ticket.rows.length === 0) {
    return res.json({ message: "❌ Invalid Ticket" });
  }

  const bookingId = ticket.rows[0].booking_id;

  // 🔹 check already used?
  const booking = await pool.query(
    "SELECT * FROM bookings WHERE id=$1",
    [bookingId]
  );

  if (booking.rows[0].status === "checked_in") {
    return res.json({ message: "⚠️ Already Checked-In" });
  }

  // 🔹 mark checked-in
  await pool.query(
    "UPDATE bookings SET status='checked_in' WHERE id=$1",
    [bookingId]
  );

  res.json({ message: "✅ Check-in Successful" });
};

export const checkInPassenger = async (req: Request, res: Response) => {
  try {
    const { code } = req.body; // BOOKING:123

    const bookingId = code.replace("BOOKING:", "");

    const result = await pool.query(
      `SELECT * FROM bookings WHERE id=$1`,
      [bookingId]
    );

    const booking = result.rows[0];

    if (!booking) {
      return res.json({ status: "INVALID", message: "Booking not found" });
    }

    if (booking.status !== "CONFIRMED") {
      return res.json({
        status: "INVALID",
        message: "Not approved yet",
      });
    }

    if (booking.boarded) {
      return res.json({
        status: "INVALID",
        message: "Already boarded",
      });
    }

    // ✅ VALID → mark boarded
    await pool.query(
      `UPDATE bookings
       SET boarded=true, boarded_at=NOW()
       WHERE id=$1`,
      [bookingId]
    );

    return res.json({
      status: "VALID",
      message: "Boarding successful",
      booking,
    });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};