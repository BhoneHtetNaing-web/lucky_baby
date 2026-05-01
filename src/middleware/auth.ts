import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

interface MyJwtPayload {
  id: string;
  role: string;
}

/* =========================
   REQUIRE LOGIN
========================= */
export const requireAuth = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

    req.user = decoded;

    next();
  } catch (err) {
    console.log("❌ AUTH ERROR:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* =========================
   REQUIRE ADMIN
========================= */
export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as MyJwtPayload;
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    req.user = decoded;

    next();
  } catch (err) {
    console.log("❌ ADMIN AUTH ERROR:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};