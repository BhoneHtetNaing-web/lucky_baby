import { Request, Response } from "express";
import { requestOTP, verifyOTP } from "./auth.service.js";

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Identifier required" });
    }

    const result = await requestOTP(identifier);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const verifyOTPController = async (req: Request, res: Response) => {
  try {
    const { identifier, code } = req.body;

    const result = await verifyOTP(identifier, code);

    res.json(result); // return token
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};