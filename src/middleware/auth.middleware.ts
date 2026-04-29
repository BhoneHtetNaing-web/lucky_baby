// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (
    req: any,
    res: Response,
    next: NextFunction
) => {
    // const authHeader = req.headers.authorization;

    // if (!authHeader) return res.status(401).json({ message: "No token" });
    
    // const token = authHeader.split(" ")[1];

    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ error: "No token" });
    }

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
};