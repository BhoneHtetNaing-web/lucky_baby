import express from "express";
import { register, sendOTP, verifyOTP, login } from "./auth.controller.js";
import jwt from "jsonwebtoken";
import { pool } from "../../db.js";

const router = express.Router();

router.post("/register", register);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE email=$1", [
    email,
  ]);

  if (!result.rows.length) {
    return res.status(400).json({ message: "User not found" });
  }

  const user = result.rows[0];

  if (user.password !== password) {
    return res.status(400).json({ message: "Wrong password" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role, // 🔥 IMPORTANT
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" },
  );

  res.json({
    token,
    role: user.role,
    userId: user.id,
  });
});

export default router;
