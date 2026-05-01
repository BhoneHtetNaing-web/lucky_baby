// import { Request, Response } from "express";
// import { pool } from "../../db.js";
// import { generateQRCode } from "../../utils/qrcode.js";
// import { io, userSockets } from "../../server.js";

// // ✅ APPROVE PAYMENT
// export const approvePayment = async (req: Request, res: Response) => {
//   const { paymentId, userId, bookingId } = req.body;

//   await pool.query(
//     `UPDATE payments SET status='APPROVED' WHERE id=$1`,
//     [paymentId]
//   );
//     // confirm booking + generate ticket
//   const ticketCode = `TKT-${Date.now()}`;

//   await pool.query(
//     "UPDATE bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2",
//     [ticketCode, bookingId]
//   );

//   // notify user in real-time
//   const socketId = userSockets.get(userId);

//   if (socketId) {
//     io.to(socketId).emit("payment-approved", { paymentId, ticketCode, bookingId });
//   }

//   res.json({ success: true });
// };

// // 🎫 GENERATE TICKET
// export const generateTicket = async (req: Request, res: Response) => {
//   const { bookingId } = req.body;

//   const ticketCode = `TKT-${Date.now()}`;

//   await pool.query(
//     `UPDATE bookings
//      SET ticket_code=$1, status='CONFIRMED'
//      WHERE id=$2`,
//     [ticketCode, bookingId]
//   );

//   res.json({ ticketCode });
// };

// export const approveAndGenerate = async (req: Request, res: Response) => {
//   const { paymentId, bookingId } = req.body;

//   await pool.query(
//     `UPDATE payments SET status='APPROVED' WHERE id=$1`,
//     [paymentId]
//   );

//   const ticketCode = `TKT-${Date.now()}`;

//   await pool.query(
//     `UPDATE bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2`,
//     [ticketCode, bookingId]
//   );

//   res.json({ ticketCode });
// };

// export const approveBooking = async (req: Request, res: Response) => {
//   const { bookingId } = req.params;

//   const qrText = `BOOKING:${bookingId}`;

//   const qr = await generateQRCode(qrText);

//   const result = await pool.query(
//     `UPDATE bookings
//        SET status='CONFIRMED',
//            qr_code=$1
//            approved_at=NOW()
//        WHERE id=$2
//        RETURNING *`,
//     [qr, bookingId],
//   );

//   res.json({
//     message: "Booking approved",
//     booking: result.rows[0],
//   });
// };
