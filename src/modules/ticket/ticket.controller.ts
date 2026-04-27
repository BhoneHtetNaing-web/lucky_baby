import { Request, Response } from "express";
import { pool } from "../../db.js";

export const getTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM bookings WHERE id=$1`,
      [id]
    );

    const booking = result.rows[0];

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(403).json({
        message: "Ticket not ready. Waiting admin approval.",
      });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err });
  }
};