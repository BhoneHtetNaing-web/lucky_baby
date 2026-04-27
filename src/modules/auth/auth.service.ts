import { pool } from "../../db.js";
import jwt from "jsonwebtoken";
import { sendSMS } from "../../services/twilio.js";

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// 👉 SEND OTP
export const requestOTP = async (identifier: string) => {
  const code = generateOTP();

  await pool.query(
    `INSERT INTO otps (identifier, code, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [identifier, code]
  );

  if (!identifier.startsWith("+")) {
    throw new Error("Phone must include country code (+959...)");
  }

  await sendSMS(identifier, `Your OTP is ${code}`);

  return { message: "OTP sent via SMS" };
};

// 👉 VERIFY OTP
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

  if (new Date() > otp.expires_at) {
    throw new Error("OTP expired");
  }

  // 🔥 create user (optional)
  const userRes = await pool.query(
    `INSERT INTO users (identifier)
     VALUES ($1)
     ON CONFLICT (identifier) DO NOTHING
     RETURNING *`,
    [identifier]
  );

  const user =
    userRes.rows[0] ||
    (
      await pool.query(`SELECT * FROM users WHERE identifier=$1`, [
        identifier,
      ])
    ).rows[0];

  // 🔐 JWT TOKEN
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );

  return { token };
};