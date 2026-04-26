import QRCode from "qrcode";
import { pool } from "../../db.js";

export const generateTicketQR = async (bookingId: number) => {
  // 🔹 generate QR string
  const qrData = `BOOKING:${bookingId}-${Date.now()}`;
  // 🔹 convert to image (base64)
  const qrImage = await QRCode.toDataURL(qrData);
    // 🔹 save ticket
  const result = await pool.query(
    `INSERT INTO tickets (booking_id, qr_code)
     VALUES ($1, $2)
     RETURNING *`,
    [bookingId, qrData]
  );
  
  return {
    ticket: result.rows[0],
    qrImage,
  };
};