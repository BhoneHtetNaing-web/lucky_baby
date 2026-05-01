import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pkg from "pg";
import multer from "multer";
import cloudinary from "cloudinary";
import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

dotenv.config();

const { Pool } = pkg;

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/* ================= APP ================= */
const app = express();
const server = http.createServer(app);

/* ================= SOCKET ================= */
const io = new Server(server, { cors: { origin: "*" } });
const userSockets = new Map();

io.on("connection", (socket) => {
  socket.on("register-user", (userId) => {
    userSockets.set(userId, socket.id);
  });

  socket.on("join-flight", (id) => {
    socket.join(`flight-${id}`);
  });
  socket.on("join-tour", (id) => {
    socket.join(`tour-${id}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* ================= CLOUDINARY ================= */
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const upload = multer({ dest: "uploads/" });

/* ================= AUTH ================= */
const requireAuth = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

interface MyJwtPayload {
  id: string;
  role: string;
}

const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as MyJwtPayload;

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/* ================= HEALTH ================= */
app.get("/", (req: Request, res: Response) => {
  res.send("🚀 FULL SYSTEM RUNNING");
});

/* ================= USERS (ADMIN CONTROL) ================= */
app.get("/admin/users", requireAdmin, async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, role, created_at FROM users",
  );
  res.json(result.rows);
});

app.post(
  "/admin/reset-password",
  requireAdmin,
  async (req: Request, res: Response) => {
    const { userId, newPassword } = req.body;

    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [
      newPassword,
      userId,
    ]);

    res.json({ success: true });
  },
);

/* ================= USER PROFILE + OWN DATA ================= */
app.get("/me", requireAuth, async (req: any, res: Response) => {
  const user = await pool.query(
    "SELECT id, email, role FROM users WHERE id=$1",
    [req.user.id],
  );
  res.json(user.rows[0]);
});
/* ================= AUTH ================= */
app.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1 and password=$2",
    [email, password],
  );

  if (!result.rows.length) {
    return res.status(400).json({ message: "User not found" });
  }

  const user = result.rows[0];

  if (user.password !== password) {
    return res.status(400).json({ message: "Wrong password" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET as string,
  );

  res.json({ token, role: user.role, userId: user.id });
});

app.post("/auth/send-code", async (req, res) => {
  const { email } = req.body;

  const code = Math.floor(100000 + Math.random() * 900000);

  await pool.query(`UPDATE users SET otp=$1 WHERE email=$2`, [code, email]);

  // send email here (nodemailer)
  console.log("OTP:", code);

  res.json({ success: true });
});

app.post("/auth/verify-code", async (req, res) => {
  const { email, code, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1 AND otp=$2",
    [email, code],
  );

  if (!user.rows.length) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  await pool.query(
    `UPDATE users
     SET password=$1, otp_verified=true
     WHERE email=$2`,
    [password, email],
  );

  res.json({ success: true });
});

app.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const exists = await pool.query("SELECT * FROM users WHERE email=$1", [
    email,
  ]);

  if (exists.rows.length > 0) {
    return res.status(400).json({ message: "User already exists" });
  }

  const result = await pool.query(
    `INSERT INTO users (email, password, role)
     VALUES ($1,$2,'user')
     RETURNING id, email, role`,
    [email, password],
  );

  const token = jwt.sign(
    { id: result.rows[0].id, role: "user" },
    process.env.JWT_SECRET as string,
  );

  res.json({ token, user: result.rows[0] });
});

/* ================= FLIGHTS ================= */
app.get("/flight", async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM flights");
  res.json(result.rows[0]);
});

/* ================= BOOKING ================= */
app.post("/booking/flight", requireAuth, async (req: any, res) => {
  const { flightId, seats } = req.body;

  const seatCheck = await pool.query(
    "SELECT * FROM seats WHERE id = ANY($1) AND status != 'available'",
    [seats],
  );

  if (seatCheck.rows.length > 0) {
    return res.status(400).json({ message: "Seat taken" });
  }

  await pool.query("UPDATE seats SET status='booked' WHERE id = ANY($1)", [
    seats,
  ]);

  const booking = await pool.query(
    `INSERT INTO bookings (user_id, flight_id, seat, status)
     VALUES ($1,$2,$3,'PENDING')
     RETURNING *`,
    [req.user.id, flightId, seats.join(",")],
  );

  res.json(booking.rows[0]);
});

/* ================= TOUR ================= */
app.get("/tours", async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM tours");
  res.json(result.rows);
});

app.post("/booking/tour", requireAuth, async (req: any, res) => {
  const { tourId } = req.body;

  const booking = await pool.query(
    `INSERT INTO tour_bookings (user_id, tour_id, status)
     VALUES ($1,$2,'PENDING')
     RETURNING *`,
    [req.user.id, tourId],
  );

  res.json(booking.rows[0]);
});

/* ================= SEATS ================= */
app.get("/seat/:flightId", async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM seats WHERE flight_id=$1", [
    req.params.flightId,
  ]);
  res.json(result.rows);
});

/* ================= LOCK SEAT ================= */
app.post("/seat/lock", async (req: any, res: Response) => {
  const { seatId, flightId } = req.body;

  await pool.query(
    "UPDATE seats SET status='locked', locked_by=$2 WHERE id=$1 AND status='available' RETURNING *",
    [seatId, req.user.id],
  );

  io.to(`flight-${flightId}`).emit("seat-update", {
    seatId,
    status: "locked",
  });

  res.json({ success: true });
});

/* ================= PAYMENT ================= */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-04-22.dahlia",
});
app.post("/stripe/create-session", async (req: Request, res: Response) => {
  const { amount, bookingId } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Travel Booking" },
          unit_amount: amount * 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.BASE_URL}/success?bookingId=${bookingId}`,
    cancel_url: `${process.env.BASE_URL}/cancel`,
    metadata: {
      bookingId,
    },
  });

  res.json({ url: session.url });
});

app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const event = req.body;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const bookingId = session.metadata.bookingId;

      await pool.query(
        "UPDATE payments SET status='APPROVED' WHERE booking_id=$1",
        [bookingId],
      );

      await pool.query("UPDATE bookings SET status='CONFIRMED' WHERE id=$1", [
        bookingId,
      ]);
    }

    res.json({ received: true });
  },
);

app.post(
  "/payment/flight",
  requireAuth,
  async (req: Request, res: Response) => {
    const { bookingId, amount } = req.body;

    await pool.query(
      `INSERT INTO payments (booking_id, amount, type, status, created_at) VALUES ($1,$2,$3, 'FLIGHT','PENDING', NOW()) RETURNING *`,
      [bookingId, amount, "FLIGHT"],
    );

    res.json({ success: true });
  },
);

app.post("/payment/tour", requireAuth, async (req: Request, res: Response) => {
  const { bookingId, amount } = req.body;

  await pool.query(
    `INSERT INTO payments (booking_id, amount, type, status, created_at) VALUES ($1,$2,$3, 'TOUR','PENDING', NOW()) RETURNING *`,
    [bookingId, amount, "TOUR"],
  );

  res.json({ success: true });
});

app.post(
  "/payment/upload",
  upload.single("file"),
  async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const result = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "payment-slips",
      });

      await pool.query(
        `INSERT INTO payment_uploads (booking_id, image_url, status)
         VALUES ($1, $2, 'PENDING')`,
        [req.body.bookingId, result.secure_url],
      );

      res.json({
        success: true,
        url: result.secure_url,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

/* ================= UPLOAD SLIP ================= */
app.post(
  "/payment/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const result = await cloudinary.v2.uploader.upload(req.file.path);

    res.json({ url: result.secure_url });
  },
);

app.get("/payment/:bookingId", async (req: Request, res: Response) => {
  const result = await pool.query(
    "SELECT * FROM payments WHERE booking_id=$1",
    [req.params.bookingId],
  );

  res.json(result.rows[0]);
});
/* ================= ADMIN APPROVE ================= */
app.post("/admin/approve-payment", requireAdmin, async (req: any, res) => {
  const { paymentId, bookingId, type, userId } = req.body;

  await pool.query("UPDATE payments SET status='APPROVED' WHERE id=$1", [
    paymentId,
  ]);

  let ticketCode = `TKT-${Date.now()}`;

  if (type === "FLIGHT") {
    await pool.query(
      "UPDATE bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2",
      [ticketCode, bookingId],
    );
  }

  if (type === "TOUR") {
    await pool.query(
      "UPDATE tour_bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2",
      [ticketCode, bookingId],
    );
  }

  const socketId = userSockets.get(userId);

  if (socketId) {
    io.to(socketId).emit("payment-approved", {
      bookingId,
      ticketCode,
      type,
    });
  }

  res.json({ success: true });
});

/* ================= CANCEL ================= */
app.post("/admin/cancel", requireAdmin, async (req, res) => {
  const { bookingId, type } = req.body;

  if (type === "FLIGHT") {
    await pool.query("UPDATE bookings SET status='CANCELLED' WHERE id=$1", [
      bookingId,
    ]);
  }

  if (type === "TOUR") {
    await pool.query(
      "UPDATE tour_bookings SET status='CANCELLED' WHERE id=$1",
      [bookingId],
    );
  }

  res.json({ success: true });
});

/* ================= TICKET ================= */
app.get("/ticket/:id", async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM bookings WHERE id=$1", [
    req.params.id,
  ]);

  await pool.query(
    `INSERT INTO tickets (booking_id, ticket_code, status, created_at) VALUES ($1,$2,'ACTIVE', NOW())`,
  );

  res.json(result.rows[0]);
});
app.get("/ticket/pdf/:bookingId", async (req, res) => {
  const { bookingId } = req.params;

  const result = await pool.query("SELECT * FROM bookings WHERE id=$1", [
    bookingId,
  ]);

  if (!result.rows.length) {
    return res.status(404).send("Not found");
  }

  const booking = result.rows[0];

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=ticket-${bookingId}.pdf`,
  );

  doc.pipe(res);
  const qr = await QRCode.toDataURL(
    `BOOKING:${bookingId}|SEAT:${booking.seat}`,
  );

  doc.fontSize(20).text("✈️ AIRLINE TICKET", { align: "center" });
  doc.moveDown();

  doc.fontSize(14).text(`Booking ID: ${bookingId}`);
  doc.text(`Seat: ${booking.seat}`);
  doc.text(`Status: ${booking.status}`);

  doc.image(qr, { width: 150 });

  doc.end();
});
/* ================= QR VERIFY ================= */
app.post("/verify", async (req: Request, res: Response) => {
  const { qr } = req.body;

  const id = qr.split("-")[1];

  const result = await pool.query("SELECT * FROM bookings WHERE id=$1", [id]);

  if (!result.rows.length) {
    return res.json({ valid: false });
  }

  const booking = result.rows[0];

  if (booking.status !== "CONFIRMED") {
    return res.json({ valid: false });
  }

  res.json({ valid: true, seat: booking.seat });
});
/* ================= HISTORY =================== */
app.get("/history", requireAuth, async (req: any, res) => {
  const flights = await pool.query(
    `SELECT id, 'flight' as type, status, created_at
     FROM bookings WHERE user_id=$1`,
    [req.user.id],
  );

  const tours = await pool.query(
    `SELECT id, 'tour' as type, status, created_at
     FROM tour_bookings WHERE user_id=$1`,
    [req.user.id],
  );

  const merged = [...flights.rows, ...tours.rows];

  merged.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  res.json(merged);
});
/* ================= ADMIN STATS ================= */
app.get("/admin/stats", requireAdmin, async (req: Request, res: Response) => {
  const revenue = await pool.query(
    "SELECT SUM(amount) FROM payments WHERE status='APPROVED'",
  );

  const users = await pool.query("SELECT COUNT(*) FROM users");

  res.json({
    revenue: revenue.rows[0].sum || 0,

    users: users.rows[0].count,
  });
});

app.get("/my-bookings", requireAuth, async (req: any, res) => {
  const flights = await pool.query(
    `
    SELECT 
      b.id,
      'flight' as type,
      b.status,
      b.seat,
      b.ticket_code,
      b.created_at,
      f.from_city,
      f.to_city,
      f.departure_time
    FROM bookings b
    JOIN flights f ON b.flight_id = f.id
    WHERE b.user_id = $1
  `,
    [req.user.id],
  );

  const tours = await pool.query(
    `
    SELECT 
      tb.id,
      'tour' as type,
      tb.status,
      tb.created_at,
      t.name
    FROM tour_bookings tb
    JOIN tours t ON tb.tour_id = t.id
    WHERE tb.user_id = $1
  `,
    [req.user.id],
  );

  const combined = [...flights.rows, ...tours.rows];

  combined.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  res.json(combined);
});

app.get("/admin/full-bookings", requireAdmin, async (req, res) => {
  const flights = await pool.query(`
    SELECT 
      b.id,
      'flight' as type,
      b.status,
      b.seat,
      b.ticket_code,
      u.email,
      f.from_city,
      f.to_city,
      p.status as payment_status
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN flights f ON b.flight_id = f.id
    LEFT JOIN payments p ON p.booking_id = b.id
  `);

  const tours = await pool.query(`
    SELECT 
      tb.id,
      'tour' as type,
      tb.status,
      u.email,
      t.name,
      p.status as payment_status
    FROM tour_bookings tb
    JOIN users u ON tb.user_id = u.id
    JOIN tours t ON tb.tour_id = t.id
    LEFT JOIN payments p ON p.booking_id = tb.id
  `);

  res.json({
    flights: flights.rows,
    tours: tours.rows,
  });
});

app.get("/admin/analytics", requireAdmin, async (req, res) => {
  const revenue = await pool.query(`
    SELECT DATE(created_at) as day, SUM(amount) as total
    FROM payments
    WHERE status='APPROVED'
    GROUP BY day
    ORDER BY day
  `);

  res.json(revenue.rows);
});

/* ================= ERROR ================= */

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.log("🔥 ERROR:", err);

  res.status(500).json({ error: "Server crashed" });
});

/* ================= START ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 FULL SYSTEM LIVE:", PORT);
});
