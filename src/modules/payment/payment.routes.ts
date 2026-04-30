import express from "express";
import multer from "multer";
import { uploadSlip } from "./payment.controller.js";
import { pool } from "../../db.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { bookingId, amount } = req.body;

  await pool.query(
    "INSERT INTO payments (booking_id, amount, status) VALUES ($1,$2,'PENDING')",
    [bookingId, amount]
  );

  res.json({ success: true });
});

router.post("/stripe", async (req, res) => {
  const { bookingId, amount } = req.body;

  // simulate stripe success
  await pool.query(
    "UPDATE bookings SET status='PAID' WHERE id=$1",
    [bookingId]
  );

  res.json({ success: true });
});

router.post("/kbzpay-slip", async (req, res) => {
  const { bookingId, imageUrl } = req.body;

  await pool.query(
    `INSERT INTO payments (booking_id, slip, status)
     VALUES ($1,$2,'PENDING')`,
    [bookingId, imageUrl]
  );

  res.json({ success: true });
});

router.post("/tour-payment", async (req, res) => {
  const { bookingId, amount, slip } = req.body;

  await pool.query(
    `INSERT INTO payments (booking_id, amount, slip, status, type)
     VALUES ($1,$2,$3,'PENDING','tour')`,
    [bookingId, amount, slip]
  );

  res.json({ success: true });
});

const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("slip"), uploadSlip);

export default router;