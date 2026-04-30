import express from "express";
import { createBooking, getBookings } from "./booking.controller.js";
import { pool } from "../../db.js";

const router = express.Router();

router.post("/", createBooking);
router.get("/", getBookings);

// GET TOUR BOOKINGS (ADMIN)
router.get("/bookings", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM tour_bookings ORDER BY id DESC"
  );
  res.json(result.rows);
});

export default router;