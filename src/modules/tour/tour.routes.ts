import express from "express";
import { createTour, getTours, getTourById } from "./tour.controller.js";
import { upload } from "../../utils/cloudinary.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = express.Router();

router.get("/", getTours);
router.get("/:id", getTourById);

// 🔐 ADMIN ONLY
router.post("/create", requireAdmin, upload.single("image"), createTour);

export default router;