import { pool } from "../../db.js";
import { sendOTPEmail } from "../email/sendgrid.js";
import jwt from "jsonwebtoken";

export const requestOTP = async (identifier: string) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await pool.query(
    `INSERT INTO otps (identifier, code, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [identifier, code]
  );

  // EMAIL SEND
  if (identifier.includes("@")) {
    await sendOTPEmail(identifier, code);
  }

  console.log("OTP SENT:", code);

  return { message: "OTP sent" };
};

export const verifyOTP = async (identifier: string, code: string) => {
  const result = await pool.query(
    `SELECT * FROM otps 
     WHERE identifier=$1 AND code=$2 
     ORDER BY id DESC LIMIT 1`,
    [identifier, code]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid OTP");
  }

  const otp = result.rows[0];

  if (new Date(otp.expires_at) < new Date()) {
    throw new Error("OTP expired");
  }

  const token = jwt.sign(
    { identifier },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  return { token };
};