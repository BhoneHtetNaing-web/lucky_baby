import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// BOOK TOUR
router.post("/", async (req, res) => {
  const { tourId, userId } = req.body;

  const result = await pool.query(
    `INSERT INTO tour_bookings (tour_id, user_id, status)
     VALUES ($1,$2,'PENDING') RETURNING *`,
    [tourId, userId]
  );

  res.json(result.rows[0]);
});

export default router;