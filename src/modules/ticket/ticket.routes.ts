import express from "express";
import { getTicket } from "./ticket.controller.js";

const router = express.Router();

router.get("/:id", getTicket);

export default router;