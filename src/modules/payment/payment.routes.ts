import express from "express";
import multer from "multer";
import { uploadSlip } from "./payment.controller.js";

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("slip"), uploadSlip);

export default router;