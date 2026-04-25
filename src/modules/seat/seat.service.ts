// seat.service.ts
import { pool } from "../../db.js";

export const holdSeats = async (
  userId: number,
  seatIds: number[]
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // lock rows
    const seats = await client.query(
      `SELECT * FROM seats
       WHERE id = ANY($1)
       FOR UPDATE`,
      [seatIds]
    );

    // ❌ already booked or held
    const invalid = seats.rows.some(
      (s) =>
        s.status === "BOOKED" ||
        (s.status === "HELD" &&
          new Date(s.hold_expires_at) > new Date())
    );

    if (invalid) {
      throw new Error("Seat not available");
    }

    // ⏱️ set hold 5 min
    await client.query(
      `UPDATE seats
       SET status='HELD',
           hold_expires_at = NOW() + INTERVAL '5 minutes'
       WHERE id = ANY($1)`,
      [seatIds]
    );

    await client.query("COMMIT");

    return { message: "Seats held for 5 minutes" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};