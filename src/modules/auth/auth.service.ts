// src/modules/auth/auth.service.ts
import { pool } from "../../db.js";

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// 🔹 SEND OTP
export const requestOTP = async (identifier: string) => {
  const code = generateOTP();

  // rate limit (60s)
  const last = await pool.query(
    `SELECT * FROM otps WHERE identifier=$1 ORDER BY id DESC LIMIT 1`,
    [identifier]
  );

  if (last.rows.length > 0) {
    const lastTime = new Date(last.rows[0].created_at).getTime();
    if (Date.now() - lastTime < 60000) {
      throw new Error("Please wait before requesting another OTP");
    }
  }

  await pool.query(
    `INSERT INTO otps (identifier, code, expires_at)
     VALUES ($1,$2,NOW() + INTERVAL '5 minutes')`,
    [identifier, code]
  );

  // 👉 DEV: console log (until SMS ready)
  console.log("OTP CODE:", code);

  // 👉 TODO: sendSMS / sendEmail here

  return { message: "OTP sent" };
};

// 🔹 VERIFY OTP
export const verifyOTP = async (identifier: string, code: string) => {
  const result = await pool.query(
    `SELECT * FROM otps
     WHERE identifier=$1 AND code=$2
     ORDER BY id DESC LIMIT 1`,
    [identifier, code]
  );

  if (!result.rows.length) {
    throw new Error("Invalid OTP");
  }

  const otp = result.rows[0];

  if (new Date(otp.expires_at) < new Date()) {
    throw new Error("OTP expired");
  }

  // 👉 create user if not exist
  let user = await pool.query(
    `SELECT * FROM users WHERE identifier=$1`,
    [identifier]
  );

  if (!user.rows.length) {
    user = await pool.query(
      `INSERT INTO users (identifier) VALUES ($1) RETURNING *`,
      [identifier]
    );
  }

  // 🔐 simple token (later JWT upgrade)
  const token = Buffer.from(`${identifier}:${Date.now()}`).toString("base64");

  return {
    token,
    user: user.rows[0],
  };
};