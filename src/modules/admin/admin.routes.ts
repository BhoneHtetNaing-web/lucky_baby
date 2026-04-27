import express from "express";
import { approveBooking } from "./admin.controller.js";

const router = express.Router();

router.put("/approve/:bookingId", approveBooking);

export default router;