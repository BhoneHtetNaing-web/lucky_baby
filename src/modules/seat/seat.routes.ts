import express from "express";
import { getSeats } from "./seat.controller.js";

const router = express.Router();

router.get("/:flightId", getSeats);

export default router;