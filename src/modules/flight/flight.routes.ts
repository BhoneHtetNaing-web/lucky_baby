import express from "express";
import { pool } from "../../db.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = express.Router();

/* =========================
   GET ALL FLIGHTS (USER)
========================= */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM flights
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch flights" });
  }
});

/* =========================
   GET SINGLE FLIGHT
========================= */
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM flights WHERE id=$1",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Flight not found" });
    }

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Error fetching flight" });
  }
});

/* =========================
   CREATE FLIGHT (ADMIN)
========================= */
router.post("/", requireAdmin, async (req, res) => {
  const { from_city, to_city, price, airline, departure_time } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO flights (from_city, to_city, price, airline, departure_time)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [from_city, to_city, price, airline, departure_time]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Flight creation failed" });
  }
});

/* =========================
   DELETE FLIGHT (ADMIN)
========================= */
router.delete("/:id", requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM flights WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

export default router;