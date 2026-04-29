import express from "express";
import { approveBooking, approvePayment, generateTicket } from "./admin.controller.js";

const router = express.Router();

router.put("/approve/:bookingId", approveBooking);
router.post("/approve-payment", approvePayment);
router.post("/generate-ticket", generateTicket);

export default router;