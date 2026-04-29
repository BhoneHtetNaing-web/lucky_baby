import express from "express";
import {
  register,
  sendOTP,
  verifyOTP,
  login,
} from "./auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);

export default router;