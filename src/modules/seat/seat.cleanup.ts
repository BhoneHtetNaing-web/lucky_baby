// seat.cleanup.ts
import { pool } from "../../db.js";

export const releaseExpiredSeats = async () => {
  await pool.query(
    `UPDATE seats
     SET status='AVAILABLE',
         hold_expires_at=NULL
     WHERE status='HELD'
     AND hold_expires_at < NOW()`
  );

  console.log("Expired seats released");
};