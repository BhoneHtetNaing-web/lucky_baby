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

export const aiCopilot = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;
    const t = message.toLowerCase();

    const flights =
      t.includes("flight") || t.includes("trip")
        ? await safeRows(
            `SELECT f.from_city, f.to_city, b.status, b.created_at
             FROM bookings b
             JOIN flights f ON b.flight_id = f.id
             WHERE b.user_id=$1
             ORDER BY b.created_at DESC
             LIMIT 5`,
            [userId],
          )
        : [];

    const tours =
      t.includes("tour")
        ? await safeRows(
            `SELECT t.name, tb.status, tb.created_at
             FROM tour_bookings tb
             JOIN tours t ON tb.tour_id = t.id
             WHERE tb.user_id=$1
             ORDER BY tb.created_at DESC
             LIMIT 5`,
            [userId],
          )
        : [];

    const payments =
      t.includes("money") || t.includes("spent")
        ? await safeRows(
            `SELECT amount, status, created_at
             FROM payments
             WHERE user_id=$1
             ORDER BY created_at DESC
             LIMIT 5`,
            [userId],
          )
        : [];

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a personal travel AI. Analyze user behavior and suggest travel.",
            },
            {
              role: "user",
              content: JSON.stringify({
                message,
                flights,
                tours,
                payments,
              }),
            },
          ],
        }),
      },
    );

    const data: any = await response.json();

    if (!response.ok) {
      return res.status(500).json({ reply: "Copilot failed" });
    }

    return res.json({
      success: true,
      reply: data?.choices?.[0]?.message?.content,
    });
  } catch (err) {
    console.log("COPILOT ERROR:", err);
    return res.status(500).json({ reply: "Server error" });
  }
};