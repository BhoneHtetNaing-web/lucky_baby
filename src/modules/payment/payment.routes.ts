// import express from "express";
// import multer from "multer";
// import { uploadSlip } from "./payment.controller.js";
// import { pool } from "../../db.js";
// import { io } from "../../server.js";
// import Stripe from "stripe";

// const router = express.Router();

// router.post("/", async (req, res) => {
//   const { bookingId, amount, userId } = req.body;

//   const result = await pool.query(
//     "INSERT INTO payments (booking_id, amount, status, user_id) VALUES ($1,$2,'PENDING',$3) RETURNING *",
//     [bookingId, amount, userId]
//   );

//   // notify admin dashboard in real-time
//   io.emit("payment_submitted", result.rows[0]);

//   res.json(result.rows[0]);
// });

// router.post("/stripe", async (req, res) => {
//   const { bookingId, amount } = req.body;

//   // simulate stripe success
//   await pool.query(
//     "UPDATE bookings SET status='PAID' WHERE id=$1",
//     [bookingId]
//   );

//   res.json({ success: true });
// });

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// router.post("/stripe-session", async (req, res) => {
//   const { bookingId, amount } = req.body;

//   const session = await stripe.checkout.sessions.create({
//     payment_method_types: ["card"],
//     mode: "payment",
//     line_items: [
//       {
//         price_data: {
//           currency: "usd",
//           product_data: {
//             name: "Flight Booking",
//           },
//           unit_amount: amount * 100,
//         },
//         quantity: 1,
//       },
//     ],
//     success_url: `myapp://success?bookingId=${bookingId}`,
//     cancel_url: `myapp://cancel`,
//   });

//   res.json({ url: session.url });
// });

// router.post("/kbzpay-slip", async (req, res) => {
//   const { bookingId, imageUrl } = req.body;

//   await pool.query(
//     `INSERT INTO payments (booking_id, slip, status)
//      VALUES ($1,$2,'PENDING')`,
//     [bookingId, imageUrl]
//   );

//   res.json({ success: true });
// });

// router.post("/tour-payment", async (req, res) => {
//   const { bookingId, amount, slip } = req.body;

//   await pool.query(
//     `INSERT INTO payments (booking_id, amount, slip, status, type)
//      VALUES ($1,$2,$3,'PENDING','tour')`,
//     [bookingId, amount, slip]
//   );

//   res.json({ success: true });
// });

// const upload = multer({ dest: "uploads/" });

// router.post("/upload", upload.single("slip"), uploadSlip);

// export default router;