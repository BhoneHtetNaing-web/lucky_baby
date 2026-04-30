import express from "express";
import { pool } from "../../db.js";
import { io } from "../../server.js";

const router = express.Router();

router.get("/:flightId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM seats WHERE flight_id=$1",
    [req.params.flightId]
  );

  res.json(result.rows);
});

router.post("/lock", async (req, res) => {
  const { seatId, flightId } = req.body;

  const seat = await pool.query(
    "SELECT * FROM seats WHERE id=$1",
    [seatId]
  );

  if (seat.rows[0].status !== "available") {
    return res.json({ success: false });
  }

  await pool.query(
    "UPDATE seats SET status='locked' WHERE id=$1",
    [seatId]
  );

  io.to(`flight-${flightId}`).emit("seat-updated", {
    seatId,
    status: "locked",
  });

  res.json({ success: true });
});

export default router;