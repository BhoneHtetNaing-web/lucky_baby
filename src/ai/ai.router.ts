// ai/router.ts
import { Request, Response } from "express";
import { pool } from "../db.js";

export const aiRouter = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ reply: "Message required" });

    const text = message.toLowerCase();

    const run = (q: string, p?: any[]) =>
      pool.query(q, p || []).then(r => r.rows);

    let context: any = {};

    // =============================
    // 🧠 INTENT ENGINE
    // =============================

    const isAdmin =
      text.includes("revenue") ||
      text.includes("users") ||
      text.includes("bookings");

    // ✈️ FLIGHT CONTEXT
    if (text.includes("flight")) {
      context.flights = await run(
        "SELECT from_city,to_city,price FROM flights ORDER BY price ASC LIMIT 5"
      );
    }

    // 🏝 TOUR CONTEXT
    if (text.includes("tour")) {
      context.tours = await run(
        "SELECT name,price FROM tours ORDER BY price ASC LIMIT 5"
      );
    }

    // =============================
    // 👑 ADMIN CONTEXT
    // =============================
    if (isAdmin) {
      context.revenue = await run(`
        SELECT SUM(amount) as total FROM payments WHERE status='APPROVED'
      `);

      context.users = await run(`
        SELECT COUNT(*) as total FROM users
      `);

      context.bookings = await run(`
        SELECT COUNT(*) as total FROM bookings
      `);
    }

    // =============================
    // 🤖 GPT BRAIN
    // =============================
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
              content: `
You are a Travel SaaS AI.

You can:
- flights
- tours
- bookings
- admin analytics

Context:
${JSON.stringify(context)}

Rules:
- short answers
- actionable
- smart suggestions
              `,
            },
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await response.json();

    res.json({
      reply:
        data?.choices?.[0]?.message?.content ||
        "I can help with travel system.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ reply: "AI error" });
  }
};