import { Request, Response } from "express";
import { pool } from "../db.js";
import { saveMemory, getAllMemory } from "./memory.js";

export const aiLearningAgent = async (req: Request, res: Response) => {
  try {
    const { message, userId } = req.body;
    const text = message.toLowerCase();

    const run = (q: string, p?: any[]) =>
      pool.query(q, p || []).then(r => r.rows);

    // =============================
    // 🧠 STEP 1: LEARN USER INTENT
    // =============================

    if (text.includes("cheap")) {
      await saveMemory(userId, "preference_price", "cheap");
    }

    if (text.includes("luxury")) {
      await saveMemory(userId, "preference_price", "luxury");
    }

    if (text.includes("flight")) {
      await saveMemory(userId, "interest", "flight");
    }

    if (text.includes("tour")) {
      await saveMemory(userId, "interest", "tour");
    }

    // =============================
    // 🧠 STEP 2: FETCH MEMORY
    // =============================
    const memory = await getAllMemory(userId);

    // =============================
    // ✈️ SMART PERSONALIZED DATA
    // =============================

    let flights = null;

    const pricePref = memory.find(m => m.key === "preference_price");

    if (pricePref?.value === "cheap") {
      flights = await run(
        "SELECT * FROM flights ORDER BY price ASC LIMIT 3"
      );
    } else {
      flights = await run(
        "SELECT * FROM flights ORDER BY price DESC LIMIT 3"
      );
    }

    // =============================
    // 🤖 AI RESPONSE WITH MEMORY
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
You are a SELF-LEARNING TRAVEL AI.

You remember user behavior:

${JSON.stringify(memory)}

You have live data:
${JSON.stringify(flights)}

Rules:
- personalize answers
- remember preferences
- improve suggestions over time
              `,
            },
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await response.json();

    res.json({
      reply: data?.choices?.[0]?.message?.content,
      memory,
      suggestions: flights,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ reply: "Memory AI error" });
  }
};