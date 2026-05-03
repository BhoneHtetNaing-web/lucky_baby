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

export const aiHistoryInsight = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const history = await safeRows(
      `SELECT 'flight' as type,
              f.from_city || ' → ' || f.to_city as title,
              b.status,
              b.created_at
       FROM bookings b
       JOIN flights f ON b.flight_id = f.id
       WHERE b.user_id=$1

       UNION ALL

       SELECT 'tour', t.name, tb.status, tb.created_at
       FROM tour_bookings tb
       JOIN tours t ON tb.tour_id = t.id
       WHERE tb.user_id=$1

       UNION ALL

       SELECT 'payment', amount::text, status, created_at
       FROM payments
       WHERE user_id=$1`,
      [userId],
    );

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
                "You are a Google Timeline style travel analyst. Be accurate.",
            },
            {
              role: "user",
              content: JSON.stringify(history),
            },
          ],
        }),
      },
    );

    const data: any = await response.json();

    if (!response.ok) {
      return res.status(500).json({ reply: "Insight failed" });
    }

    return res.json({
      success: true,
      reply: data?.choices?.[0]?.message?.content,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ reply: "History AI failed" });
  }
};