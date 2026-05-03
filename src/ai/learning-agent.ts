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

export const aiLearning = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

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
              content: "Explain clearly in simple English.",
            },
            { role: "user", content: message },
          ],
        }),
      },
    );

    const data: any = await response.json();

    if (!response.ok) {
      return res.status(500).json({ reply: "AI error" });
    }

    return res.json({
      reply: data?.choices?.[0]?.message?.content,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ reply: "Learning failed" });
  }
};