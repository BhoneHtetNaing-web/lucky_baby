// auth.service.ts
import { pool } from "../../db.js";
import { generateOTP, sendEmailOTP } from "./otp.service.js";

export const requestOTP = async (identifier: string) => {
    const code = generateOTP();

    await pool.query(
        `INSERT INTO otps (identifier, code, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
        [identifier, code]
    );

    if (identifier.includes("@")) {
        await sendEmailOTP(identifier, code);
    }
    
    return { message: "OPT sent" };
};

export const verifyOTP = async (identifier: string, code: string) => {
    const result = await pool.query(
        `SELECT * FROM otps
        WHERE identifier=$1 AND code=$2 AND is_used=false`,
        [identifier, code]
    );

    if (result.rows.length === 0) {
        throw new Error("Invalid OTP");
    }

    const otp = result.rows[0];

    if (new Date(otp.expires_at) < new Date()) {
        throw new Error("OTP expired");
    }

    await pool.query(
        `UPDATE otps SET is_used=true WHERE id=$1`,
        [otp.id]
    );

    // check user
    let user = await pool.query(
        `SELECT * FROM users WHERE email=$1 OR phone=$1`,
        [identifier]
    );

    if (user.rows.length === 0) {
        user = await pool.query(
            `INSERT INTO users (email, phone)
            VALUES ($1, $2) RETURNING *`,
            [
                identifier.includes("@") ? identifier : null,
                !identifier.includes("@") ? identifier : null,
            ]
        );
    }

    return { user: user.rows[0] };
};