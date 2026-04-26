import { pool } from "../../db.js";
import { generateTicketQR } from "../ticket/ticket.service.js";

export const createBooking = async (
    userId: number,
    flightId: number,
    seatIds: number[]
) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // lock seats
        const seats = await client.query(
            `SELECT * FROM seats
            WHERE id = ANY($1)
            FOR UPDATE`,
            [seatIds]
        );

        // check already booked
        const alreadyBooked = seats.rows.some((s) => s.is_booked);

        if (alreadyBooked) {
            throw new Error("Some seats already booked");
        }

        // calculate price
        const flight = await client.query(
            `SELECT price FROM flights WHERE id=$1`,
            [flightId]
        );

        const totalPrice = flight.rows[0].price * seatIds.length;

        // create booking
        const booking = await client.query(
            `INSERT INTO bookings (user_id, flight_id, total_price)
            VALUES ($1,$2,$3) RETURNING *`,
            [userId, flightId, totalPrice]
        );

        const bookingId = booking.rows[0].id;
        // insert booking seats
        for (let seatId of seatIds) {
            await client.query(
                `INSERT INTO booking_seats (booking_id, seat_id)
                VALUES ($1,$2)`,
                [bookingId, seatId]
            );
        }

        // mark seats booked
        await client.query(
            `UPDATE seats
            SET is_booked = true
            WHERE id = ANY($1)`,
            [seatIds]
        );

        await client.query("COMMIT");

        return booking.rows[0];
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};

export const confirmBooking = async (bookingId: number) => {
  // update booking
  await pool.query(
    "UPDATE bookings SET status='CONFIRMED' WHERE id=$1",
    [bookingId]
  );

  // generate QR
  const qr = await generateTicketQR(bookingId);

  // save QR
  await pool.query(
    "UPDATE bookings SET qr_code=$1 WHERE id=$2",
    [qr, bookingId]
  );

  return { success: true };
};