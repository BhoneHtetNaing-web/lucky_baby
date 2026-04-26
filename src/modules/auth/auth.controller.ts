import { Request, Response } from "express";
import { requestOTP, verifyOTP } from "./auth.service.js";

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    const result = await requestOTP(identifier);

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      message: err.message,
    });
  }
};

export const verify = async (req: Request, res: Response) => {
    const { identifier, code } = req.body;
    const data = await verifyOTP (identifier, code);
    res.json(data);
};

export const sendOtpController = async (req: Request, res: Response) => {
  const { identifier } = req.body;

  const result = await requestOTP(identifier);

  res.json(result);
};