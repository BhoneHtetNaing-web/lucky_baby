import express from "express";
import { approveBooking, approvePayment, generateTicket } from "./admin.controller.js";
import { pool } from "../../db.js";
import jwt from "jsonwebtoken";
import { requireAdmin } from "../../middleware/auth.js";
import { io, userSockets } from "../../server.js";

const router = express.Router();
/* =========================
   🔐 ADMIN LOGIN
========================= */
// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   const result = await pool.query(
//     "SELECT * FROM users WHERE email=$1 AND role='admin'",
//     [email]
//   );

//   const admin = result.rows[0];

//   if (!admin || admin.password !== password) {
//     return res.status(401).json({ message: "Invalid admin login" });
//   }

//   const token = jwt.sign(
//     { id: admin.id, role: "admin" },
//     process.env.JWT_SECRET as string,
//     { expiresIn: "7d" }
//   );

//   res.json({ token, admin });
// });


/* =========================
   📦 GET BOOKINGS
========================= */
router.get("/bookings", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM bookings ORDER BY created_at DESC"
  );

  res.json(result.rows);
});

/* =========================
   ❌ CANCEL BOOKING
========================= */
router.post("/cancel-booking", async (req, res) => {
  const { bookingId } = req.body;

  // cancel booking
  await pool.query(
    "UPDATE bookings SET status='CANCELLED' WHERE id=$1",
    [bookingId]
  );

  // 🔓 release seats
  await pool.query(
    "UPDATE seats SET status='available' WHERE id IN (SELECT unnest(string_to_array(seat, ','))::int FROM bookings WHERE id=$1)",
    [bookingId]
  );

  res.json({ success: true });
});

router.put("/approve/:bookingId", approveBooking);
router.post("/approve-payment", approvePayment);
router.post("/generate-ticket", generateTicket);

export default router;