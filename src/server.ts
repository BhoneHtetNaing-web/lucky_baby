// src/server.ts
import express from "express";
import { sendOTP, verify } from "./modules/auth/auth.controller.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

const app = express();
app.use(express.json());

app.get("/me", authMiddleware, (req: any, res) => {
    res.json({ user: req.user });
});

app.post("/auth/request-otp", sendOTP);
app.post("/auth/verify-otp", verify);

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});