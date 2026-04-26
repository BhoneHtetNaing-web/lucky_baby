// src/routes/auth.routes.ts
import { Router } from "express";
import { sendOTP, verifyOTPController } from "../../modules/auth/auth.controller.js";

const router = Router();

router.post("/auth/request-otp", sendOTP);
router.post("/auth/verify-otp", verifyOTPController);

export default router;