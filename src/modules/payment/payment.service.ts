import fs from "fs";
import { pool } from "../../db.js";

interface Booking {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  paymentSlip?: string;
}

// 👉 temp in-memory DB (later PostgreSQL)
const bookings: Booking[] = [];

export const createPayment = async (bookingId: string) => {
  const booking = bookings.find((b) => b.id === bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  booking.status = "pending";

  return booking;
};

export const savePaymentSlip = async (
  bookingId: string,
  filePath: string
) => {
  const booking = bookings.find((b) => b.id === bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  booking.paymentSlip = filePath;
  booking.status = "pending";

  return booking;
};

export const approveBooking = async (bookingId: string) => {
  const booking = bookings.find((b) => b.id === bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  booking.status = "confirmed";

  return booking;
};

export const createPaymentRequest = async (
  userId: string,
  flightId: string,
  seats: string[],
  slipUrl: string
) => {
  const result = await pool.query(
    `INSERT INTO bookings 
     (user_id, flight_id, seats, slip_url, status)
     VALUES ($1, $2, $3, $4, 'PENDING')
     RETURNING *`,
    [userId, flightId, seats, slipUrl]
  );

  return result.rows[0];
};