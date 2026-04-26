import express from "express";
import { checkIn } from "./checkin.controller.js";

const router = express.Router();

router.post("/check-in", checkIn);

export default router;