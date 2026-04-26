import fs from "fs";

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