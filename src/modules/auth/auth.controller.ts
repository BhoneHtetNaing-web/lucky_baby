import { Request, Response } from "express";
import { requestOTP, verifyOTP } from "./auth.service.js";

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    const result = await requestOTP(identifier);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
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