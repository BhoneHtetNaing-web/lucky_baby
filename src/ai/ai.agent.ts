import { Request, Response } from "express";
import { pool } from "../db.js";

export const aiBookingAgent = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const text = message.toLowerCase();

    const run = (q: string, p?: any[]) =>
      pool.query(q, p || []).then(r => r.rows);

    let actionResult: any = null;

    // =============================
    // ✈️ AUTO FLIGHT BOOKING AGENT
    // =============================
    if (text.includes("cheap flight")) {
      const flight = await run(`
        SELECT * FROM flights ORDER BY price ASC LIMIT 1
      `);

      actionResult = {
        action: "FLIGHT_SUGGESTED",
        data: flight[0],
      };
    }

    // =============================
    // 🏝 TOUR AGENT
    // =============================
    if (text.includes("best tour")) {
      const tours = await run(`
        SELECT * FROM tours ORDER BY price ASC LIMIT 3
      `);

      actionResult = {
        action: "TOUR_SUGGESTED",
        data: tours,
      };
    }

    // =============================
    // 🎟 AUTO BOOKING ENGINE
    // =============================
    if (text.includes("book")) {
      const flight = await run(`
        SELECT * FROM flights ORDER BY price ASC LIMIT 1
      `);

      const booking = await pool.query(
        `INSERT INTO bookings (user_id, flight_id, status)
         VALUES ($1,$2,'PENDING') RETURNING *`,
        [req.body.userId || 1, flight[0].id]
      );

      actionResult = {
        action: "BOOKING_CREATED",
        data: booking.rows[0],
      };
    }

    // =============================
    // 💳 PAYMENT HELP
    // =============================
    if (text.includes("payment")) {
      actionResult = {
        action: "PAYMENT_INFO",
        data: {
          methods: ["KBZ Pay", "Wave Pay", "Stripe"],
        },
      };
    }

    // =============================
    // 🤖 FINAL AI EXPLANATION
    // =============================
    const ai = await fetch(
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
              content: `
You are an AI travel agent.

You receive system action result:
${JSON.stringify(actionResult)}

Rules:
- Explain like assistant
- If booking created → confirm it
- If suggestion → recommend next step
              `,
            },
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await ai.json();

    res.json({
      action: actionResult?.action || "CHAT",
      data: actionResult?.data || null,
      reply: data?.choices?.[0]?.message?.content,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ reply: "AI Agent error" });
  }
};