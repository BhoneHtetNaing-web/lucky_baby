// booking.controller.ts
import { Request, Response } from "express";
import { createBooking } from "./booking.service.js";
import { pool } from "../../db.js";

export const bookSeats = async (req: any, res: Response) => {
  try {
    const { flightId, seatIds } = req.body;
    const userId = req.user.userId;

    const booking = await createBooking(userId, flightId, seatIds);

    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

