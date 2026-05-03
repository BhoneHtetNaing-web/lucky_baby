import express, { Request, Response } from "express";
import fetch from "node-fetch";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const safeRows = async (query: string, params: any[] = []) => {
  try {
    const res = await pool.query(query, params);
    return res.rows || [];
  } catch (err) {
    console.log("DB ERROR:", err);
    return [];
  }
};

export const aiAgent = async (req: any, res: Response) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    const flight = await safeRows(
      "SELECT * FROM flights ORDER BY price ASC LIMIT 1",
    );

    if (!flight.length) {
      return res.json({ reply: "No flights available" });
    }

    const f = flight[0];

    const booking = await pool.query(
      `INSERT INTO bookings (user_id, flight_id, status, created_at)
       VALUES ($1,$2,'PENDING',NOW())
       RETURNING *`,
      [userId, f.id],
    );

    return res.json({
      reply: "Auto booking created",
      data: booking.rows[0],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ reply: "Agent failed" });
  }
};