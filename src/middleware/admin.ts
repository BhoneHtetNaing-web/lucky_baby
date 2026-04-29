import jwt from "jsonwebtoken";

export const requireAdmin = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  const decoded: any = jwt.verify(
    token,
    process.env.JWT_SECRET as string
  );

  if (decoded.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  req.user = decoded;
  next();
};