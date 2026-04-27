import express from "express";
import { checkIn } from "./checkin.controller.js";
import { checkInPassenger } from "./checkin.controller.js";

const router = express.Router();

router.post("/check-in", checkIn);
router.post("/scan", checkInPassenger);

export default router;