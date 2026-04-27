import { pool } from "../../db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const requestOTP = async (identifier: string) => {
  const code = generateOTP();

  await pool.query(
    `INSERT INTO otps (identifier, code, expires_at)
     VALUES ($1,$2,NOW()+INTERVAL '5 minutes')`,
    [identifier, code]
  );

  await transporter.sendMail({
    from: `"Lucky Treasure" <${process.env.EMAIL_USER}>`,
    to: identifier,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: ${code}</h2>`,
  });

  return { message: "OTP sent" };
};

export const verifyOTP = async (identifier: string, code: string) => {
  const result = await pool.query(
    `SELECT * FROM otps
     WHERE identifier=$1 AND code=$2
     ORDER BY id DESC LIMIT 1`,
    [identifier, code]
  );

  if (!result.rows.length) throw new Error("Invalid OTP");

  const otp = result.rows[0];

  if (new Date(otp.expires_at) < new Date()) {
    throw new Error("OTP expired");
  }

  const token = jwt.sign({ identifier }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

  return { token };
};