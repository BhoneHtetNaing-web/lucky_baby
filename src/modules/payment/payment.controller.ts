import { Request, Response } from "express";
import {
  createPayment,
  savePaymentSlip,
  approveBooking,
} from "./payment.service.js";
import { pool } from "../../db.js";
import { generateTicketQR } from "../ticket/ticket.service.js";
import { sendTicketEmail } from "../notification/email.service.js";
import { createPaymentRequest } from "./payment.service.js";

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
    const { flightId, seats } = req.body;
    const userId = (req as any).user.id;

    const slipUrl = (req as any).file?.path; // multer upload

    const booking = await createPaymentRequest(
      userId,
      flightId,
      JSON.parse(seats),
      slipUrl
    );

    res.json({
      message: "Payment submitted, waiting admin approval",
      booking,
    });
  } catch (err) {
    res.status(500).json({ message: "error", err });
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
  const payment = await pool.query(
    "UPDATE payments SET status='APPROVED' WHERE id=$1 RETURNING *",
    [id],
  );

  const bookingId = payment.rows[0].booking_id;

  // 2. confirm booking
  await pool.query(
    "UPDATE bookings SET status='CONFIRMED' WHERE id = (SELECT booking_id FROM payments WHERE id=$1)",
    [bookingId],
  );

  const assignSeat = async (bookingId: number) => {
    const seat = `A-${Math.floor(Math.random() * 30) + 1}`;
    const gate = `G${Math.floor(Math.random() * 5) + 1}`;
    const group = Math.ceil(Math.random() * 4);

    await pool.query(
      `UPDATE bookings 
     SET status='confirmed',
         seat_number=$1,
         gate=$2,
         boarding_group=$3
     WHERE id=$4`,
      [seat, gate, group, bookingId],
    );
  };

  // 3. generate ticket + QR
  const { ticket, qrImage } = await generateTicketQR(bookingId);

  await pool.query(
    "UPDATE bookings SET qr_code=$1 WHERE id = (SELECT booking_id FROM payments WHERE id=$2)",
    [qrImage, ticket],
  );

  // 4. get user email
  const user = await pool.query(
    `SELECT u.email FROM users u
     JOIN bookings b ON u.id = b.user_id
     WHERE b.id=$1`,
    [bookingId],
  );

  // 5. send email
  await sendTicketEmail(user.rows[0].email, qrImage);

  res.json({
    message: "Payment approved & ticket generated",
    ticket,
  });
};
