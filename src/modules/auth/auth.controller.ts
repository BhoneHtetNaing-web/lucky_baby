import { Request, Response } from "express";
import { requestOTP, verifyOTP } from "./auth.service.js";

export const sendOTP = async (req: Request, res: Response) => {
    const { identifier } = req.body;
    const data = await requestOTP(identifier);
    res.json(data);
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