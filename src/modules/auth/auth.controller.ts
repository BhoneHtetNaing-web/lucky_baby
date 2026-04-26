// src/modules/auth/auth.controller.ts
import { requestOTP, verifyOTP } from "./auth.service.js";
import { Request, Response } from "express";

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Identifier required" });
    }

    const result = await requestOTP(identifier);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const verifyOTPController = async (req: Request, res: Response) => {
  try {
    const { identifier, code } = req.body;

    const result = await verifyOTP(identifier, code);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};