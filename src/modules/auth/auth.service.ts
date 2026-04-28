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
     WHERE identifier=$1
     ORDER BY id DESC
     LIMIT 1`,
    [identifier]
  );

  if (result.rows.length === 0) {
    throw new Error("No OTP found");
  }

  const otp = result.rows[0];

  console.log("DB:", otp.code);
  console.log("USER:", code);

  // ✅ check code
  if (String(otp.code) !== String(code)) {
    throw new Error("Invalid OTP");
  }

  // ✅ check expire
  if (new Date() > new Date(otp.expires_at)) {
    throw new Error("OTP expired");
  }

  return {
    success: true,
    message: "OTP verified",
   };
};