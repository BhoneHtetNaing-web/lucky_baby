import express from "express";
import { getTicket } from "./ticket.controller.js";
import { pool } from "../../db.js";

const router = express.Router();

router.get("/:bookingId", async (req, res) => {
  const result = await pool.query(
    "SELECT status, ticket_code FROM bookings WHERE id=$1",
    [req.params.bookingId]
  );

  res.json(result.rows[0]);
});

router.get("/:id", getTicket);

export default router;