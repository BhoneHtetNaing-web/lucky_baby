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

export const aiRouter = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const t = message.toLowerCase();

    if (t.match(/book|buy|confirm|pay|checkout/)) {
      return res.json({ route: "/ai/agent" });
    }

    if (t.match(/history|timeline|insight|spending/)) {
      return res.json({ route: "/ai/history-insight" });
    }

    if (t.match(/learn|what is|how to|explain/)) {
      return res.json({ route: "/ai/learning" });
    }

    return res.json({ route: "/ai/copilot" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ route: "/ai/copilot" });
  }
};

