import { pool } from "../../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../utils/mailer.js";
import { Request, Response } from "express";

/* =========================
   REGISTER
========================= */
export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (email, password)
     VALUES ($1, $2)`,
    [email, hashed]
  );

  res.json({ message: "Registered. Please verify email." });
};

/* =========================
   SEND OTP
========================= */
export const sendOTP = async (req: Request, res: Response) => {
  const { email } = req.body;

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await pool.query(
    `INSERT INTO email_otps (email, code, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [email, code]
  );

  await sendEmail(email, code);

  console.log("OTP:", code);

  res.json({ message: "OTP sent" });
};

/* =========================
   VERIFY OTP
========================= */
export const verifyOTP = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  const result = await pool.query(
    `SELECT * FROM email_otps
     WHERE email=$1 AND code=$2
     ORDER BY id DESC LIMIT 1`,
    [email, code]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  const otp = result.rows[0];

  if (new Date() > new Date(otp.expires_at)) {
    return res.status(400).json({ error: "OTP expired" });
  }

  await pool.query(
    `UPDATE users SET is_verified=true WHERE email=$1`,
    [email]
  );

  res.json({ message: "Verified" });
};

/* =========================
   LOGIN
========================= */
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await pool.query(
    `SELECT * FROM users WHERE email=$1`,
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ error: "User not found" });
  }

  const user = result.rows[0];

  if (!user.is_verified) {
    return res.status(403).json({ error: "Verify email first" });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(400).json({ error: "Wrong password" });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    secret,
    { expiresIn: "7d" }
  );

  res.json({ token });
};