// auth.service.ts
import { pool } from "../../db.js";
import { generateOTP, sendEmailOTP } from "./otp.service.js";
import jwt from "jsonwebtoken";
import { sendSMS } from "../notification/twilio.service.js";

// const generateToken = (user: any) => {
//   return jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
//     expiresIn: "7d",
//   });
// };

export const requestOTP = async (identifier: string) => {
  const code = generateOTP();

  // before insert OTP
  const lastOTP = await pool.query(
    `SELECT * FROM otps
        WHERE identifier=$1
        ORDER BY id DESC LIMIT 1`,
    [identifier],
  );

  if (lastOTP.rows.length > 0) {
    const lastTime =
      new Date(lastOTP.rows[0].expires_at).getTime() - 5 * 60 * 1000;
    const now = Date.now();

    if (now - lastTime < 60000) {
      throw new Error("Wait before requesting another OTP");
    }
  }

  await pool.query(
    `INSERT INTO otps (identifier, code, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [identifier, code],
  );

  await sendSMS(identifier, `Your OTP is ${code}`);

  if (identifier.includes("@")) {
    await sendEmailOTP(identifier, code);
  }

  return { message: "OPT sent" };
};

export const verifyOTP = async (identifier: string, code: string) => {
  const result = await pool.query(
    `SELECT * FROM otps
        WHERE identifier=$1 AND code=$2 AND is_used=false`,
    [identifier, code],
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid OTP");
  }

  const otp = result.rows[0];

  if (new Date(otp.expires_at) < new Date()) {
    throw new Error("OTP expired");
  }

  await pool.query(`UPDATE otps SET is_used=true WHERE id=$1`, [otp.id]);

  // verifyOTP
  if (otp.attempts >= 3) {
    throw new Error("Too many attempts");
  }

  // wrong OTP
  await pool.query(`UPDATE otps SET attempts = attempts + 1 WHERE id=$1`, [
    otp.id,
  ]);

  // check user
  let user = await pool.query(
    `SELECT * FROM users WHERE email=$1 OR phone=$1`,
    [identifier],
  );

  if (user.rows.length === 0) {
    user = await pool.query(
      `INSERT INTO users (email, phone)
            VALUES ($1, $2) RETURNING *`,
      [
        identifier.includes("@") ? identifier : null,
        !identifier.includes("@") ? identifier : null,
      ],
    );
  }

  // const token = generateToken(user.rows[0]);
  const token = jwt.sign(
    { identifier },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  )

  return { user: user.rows[0], token };
};
