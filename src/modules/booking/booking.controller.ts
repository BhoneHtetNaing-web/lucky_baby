// booking.controller.ts
import { Request, Response } from "express";
import { pool } from "../../db.js";

// export const bookSeats = async (req: any, res: Response) => {
//   try {
//     const { flightId, seatIds } = req.body;
//     const userId = req.user.userId;

//     const booking = await createBooking(userId, flightId, seatIds);

//     res.json(booking);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// };

export const createBooking = async (req: Request, res: Response) => {
  try {
    const { flightId, seats } = req.body;

    const result = await pool.query(
      `INSERT INTO bookings (flight_id, seats, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING *`,
      [flightId, seats]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

export const getBookings = async (req: Request, res: Response) => {
  const result = await pool.query(`SELECT * FROM bookings`);
  res.json(result.rows);
};

// booking.controller.ts

export const lockSeat = async (req: Request, res: Response) => {
  const { seatId } = req.body;

  const seat = await pool.query(
    "SELECT * FROM seats WHERE id=$1 FOR UPDATE",
    [seatId]
  );

  if (seat.rows[0].status !== "available") {
    return res.status(400).json({ error: "Seat not available" });
  }

  await pool.query(
    "UPDATE seats SET status='locked' WHERE id=$1",
    [seatId]
  );

  res.json({ success: true });
};

