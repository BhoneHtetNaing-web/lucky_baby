import { Request, Response } from "express";
import { pool } from "../../db.js";
import { generateQRCode } from "../../utils/qrcode.js";

export const approveBooking = async (req: Request, res: Response) => {
  const { bookingId } = req.params;

  const qrText = `BOOKING:${bookingId}`;

  const qr = await generateQRCode(qrText);

  const result = await pool.query(
    `UPDATE bookings
       SET status='CONFIRMED',
           qr_code=$1
           approved_at=NOW()
       WHERE id=$2
       RETURNING *`,
    [qr, bookingId],
  );

  res.json({
    message: "Booking approved",
    booking: result.rows[0],
  });
};
