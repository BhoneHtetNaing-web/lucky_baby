import OpenAI from "openai";
import { Request, Response } from "express";
import { pool } from "../../db.js";

export const getAutoReply = (msg: string) => {
  const text = msg.toLowerCase();

  if (text.includes("visa")) {
    return "🛂 Visa service available. Please submit your request in Visa tab.";
  }

  if (text.includes("price")) {
    return "💰 Prices depend on flight & date. Please search flights.";
  }

  if (text.includes("hello")) {
    return "👋 Hello! How can we help you?";
  }

  return "🤖 Thanks for your message. Our team will reply soon.";
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const aiChat = async (req: Request, res: Response) => {
  const { message } = req.body;
  const flights = await pool.query("SELECT * FROM flights LIMIT 3");

  const systemPrompt = `
Flights available:
${JSON.stringify(flights.rows)}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are Lucky Treasure Travel AI assistant.

Available flights:
${JSON.stringify(flights.rows)}

App services:
- Flight booking
- Visa service
- Hotel reservation
- Taxi service

Always:
- Help user clearly
- Suggest app features
- Keep answers short
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = completion.choices[0].message.content;

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
};
