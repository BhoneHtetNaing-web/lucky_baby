// src/server.ts
import express from "express";
import { sendOTP, verify } from "./modules/auth/auth.controller.js";

const app = express();
app.use(express.json());

app.post("/auth/request-otp", sendOTP);
app.post("/auth/verify-otp", verify);

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});