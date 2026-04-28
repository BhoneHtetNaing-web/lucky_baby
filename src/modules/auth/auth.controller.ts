import { requestOTP, verifyOTP } from "./auth.service.js";
import { Request, Response } from "express";

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    const result = await requestOTP(identifier);

    res.json(result);
  } catch (err) {
    console.error("OTP ERROR:", err);
    if (err instanceof Error) {
      return res.status(500).json({ error: err.message });
    }
    res.status(500).json({ error: "Unknown error occurred" });
  }
};

export const verifyOTPController = async (req: Request, res: Response) => {
  try {
    const { identifier, code } = req.body;
    
    const data = await verifyOTP(identifier, code);

    return res.json(data);
  } catch (err) {
    console.error("OTP ERROR:", err);

    if (err instanceof Error) {
      return res.status(500).json({ error: err.message });
    }
    res.status(401).json({ error: "Unknown error occurred" });
  }
};
