import { Request, Response } from "express";
import { requestOTP, verifyOTP } from "./auth.service.js";
import { pool } from "../../db.js";
import { transporter } from "../email/mail.js";

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Identifier required" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await pool.query(
      `INSERT INTO otps (identifier, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
      [identifier, code],
    );

    console.log("OTP:", code); // 👈 DEBUG (VERY IMPORTANT)

    // EMAIL SEND
    if (identifier.includes("@")) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: identifier,
        subject: "Your OTP Code",
        text: `Your OTP is ${code}`,
      });
    }

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("OTP ERROR:", err);
    if (err instanceof Error) {
      return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: "OTP error occur." });
  }
};

export const verifyOTPController = async (req: Request, res: Response) => {
  try {
    const { identifier, code } = req.body;
    const result = await verifyOTP(identifier, code);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};
