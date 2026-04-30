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

const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("slip"), uploadSlip);

export default router;