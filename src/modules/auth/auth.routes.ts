import express from "express";
import { sendOTP, verifyOTPController } from "./auth.controller.js";

const router = express.Router();

router.post("/request-otp", sendOTP);
router.post("/verify-otp", verifyOTPController);

export default router;