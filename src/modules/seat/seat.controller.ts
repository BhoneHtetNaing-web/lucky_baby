// seat.controller.ts
import { Request, Response } from "express";
import { pool } from "../../db.js";
import { holdSeats } from "./seat.service.js";

export const getSeats = async (req: Request, res: Response) => {
    const { flightId } = req.params;

    const result = await pool.query(
        `SELECT * FROM seats WHERE flight_id=$1 ORDER BY seat_number`,
        [flightId]
    );

    res.json(result.rows);
};

export const holdSeatsController = async (req: any, res: Response) => {
    try {
        const { seatIds } = req.body;
        const userId = req.user.userId;

        const data = await holdSeats(userId, seatIds);
        res.json(data);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};