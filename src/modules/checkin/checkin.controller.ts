import { pool } from "../../db.js";

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