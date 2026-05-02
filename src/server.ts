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
  socket.on("admin-join", () => {
    socket.join("admin-room");
  });

  socket.on("disconnect", () => {
    for (let [userId, id] of userSockets.entries()) {
      if (id === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
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
app.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message is required" });
    }

    const text = message.toLowerCase();

    // =============================
    // 🧠 SMART TRAVEL INTENT ROUTER
    // =============================

    // ✈️ Cheapest flight logic (instant response)
    if (text.includes("cheapest flight")) {
      const flight = await pool.query(
        "SELECT * FROM flights ORDER BY price ASC LIMIT 1"
      );

      if (flight.rows.length > 0) {
        return res.json({
          reply: `✈️ Cheapest flight:\n${flight.rows[0].from} → ${flight.rows[0].to}\n💰 $${flight.rows[0].price}`,
        });
      }
    }

    // 🏝 Best tours
    if (text.includes("best tour") || text.includes("3 days")) {
      const tours = await pool.query(
        "SELECT * FROM tours ORDER BY price ASC LIMIT 3"
      );

      return res.json({
        reply:
          "🏝 Best Travel Packages:\n\n" +
          tours.rows
            .map(
              (t: any) =>
                `• ${t.title} - ${t.price} MMK`
            )
            .join("\n"),
      });
    }

    // 🧭 Itinerary generator
    if (text.includes("itinerary")) {
      return res.json({
        reply:
          "🧭 3-Day Auto Itinerary:\n\n" +
          "Day 1: Yangon City Tour\n" +
          "Day 2: Bagan Sunset & Pagodas\n" +
          "Day 3: Inle Lake Boat Experience",
      });
    }

    // 💳 payment help
    if (text.includes("payment")) {
      return res.json({
        reply:
          "💳 Payment Options:\n- KBZ Pay\n- Wave Pay\n- Stripe Card\nUpload slip after payment for approval.",
      });
    }

    // =============================
    // 🤖 GPT (MAIN BRAIN)
    // =============================

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `
You are a high-level AI travel assistant inside a booking platform.

You can help with:
- flights
- tours
- booking system
- payments
- travel planning
- itineraries

Always answer short, practical, and helpful.
If user asks pricing, suggest cheapest options.
              `,
            },
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;

    // =============================
    // 🔁 FINAL FALLBACK
    // =============================

    if (!reply) {
      return res.json({
        reply:
          "🤖 I can help you with flights, tours, booking, payments, and travel plans.",
      });
    }

    return res.json({ reply });
  } catch (err) {
    console.log("AI ERROR:", err);

    return res.status(500).json({
      reply: "⚠️ AI service temporarily unavailable. Try again later.",
    });
  }
});
app.post("/admin/ai", requireAdmin, async (req, res) => {
  const { message } = req.body;

  if (message.includes("revenue")) {
    const result = await pool.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE status='APPROVED'",
    );

    return res.json({
      reply: `💰 Total Revenue: ${result.rows[0].total}`,
    });
  }

  return res.json({ reply: "Admin AI ready" });
});
/* ================= USERS (ADMIN CONTROL) ================= */
app.get("/admin/users", requireAdmin, async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC",
  );

  res.json(result.rows);
});

app.post("/admin/reset-password", requireAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;

  await pool.query("UPDATE users SET password=$1 WHERE id=$2", [
    newPassword,
    userId,
  ]);

  res.json({ success: true });
});

/* ================= USER PROFILE + OWN DATA ================= */
app.get("/me", requireAuth, async (req: any, res) => {
  const user = await pool.query(
    "SELECT id, email, role FROM users WHERE id=$1",
    [req.user.id],
  );

  res.json(user.rows[0]);
});
/* ================= AUTH ================= */
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE email=$1", [
    email,
  ]);

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
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;

  const exists = await pool.query("SELECT id FROM users WHERE email=$1", [
    email,
  ]);

  if (exists.rows.length) {
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
app.post("/auth/send-code", async (req, res) => {
  const { email } = req.body;

  const code = Math.floor(100000 + Math.random() * 900000);

  await pool.query("UPDATE users SET otp=$1 WHERE email=$2", [code, email]);

  console.log("OTP:", code);

  res.json({ success: true });
});
app.post("/auth/verify-code", async (req, res) => {
  const { email, code, password } = req.body;

  const user = await pool.query(
    "SELECT id FROM users WHERE email=$1 AND otp=$2",
    [email, code],
  );

  if (!user.rows.length) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  await pool.query(
    `UPDATE users SET password=$1, otp_verified=true WHERE email=$2`,
    [password, email],
  );

  res.json({ success: true });
});
/* ================= FLIGHTS ================= */
app.get("/flight", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM flights ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch flights" });
  }
});

/* ================= SEATS ================= */
app.get("/seat/:flightId", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM seats WHERE flight_id=$1 ORDER BY id ASC",
      [req.params.flightId],
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Seat fetch failed" });
  }
});

/* ================= LOCK SEAT ================= */
app.post("/seat/lock", requireAuth, async (req: any, res: Response) => {
  try {
    const { seatId, flightId } = req.body;

    const result = await pool.query(
      `
      UPDATE seats
      SET status='locked',
          locked_by=$2,
          updated_at=NOW()
      WHERE id=$1 AND status='available'
      RETURNING *
      `,
      [seatId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Seat already taken" });
    }

    io.to(`flight-${flightId}`).emit("seat-update", {
      seatId,
      status: "locked",
    });

    res.json({
      success: true,
      seat: result.rows[0],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Seat lock failed" });
  }
});

/* ================= BOOKING FLIGHT ================= */
app.post("/booking/flight", requireAuth, async (req: any, res: Response) => {
  const client = await pool.connect();

  try {
    const { flightId, seats } = req.body;

    await client.query("BEGIN");

    // 🔥 check seat availability
    const seatCheck = await client.query(
      "SELECT * FROM seats WHERE id = ANY($1) AND status != 'available'",
      [seats],
    );

    if (seatCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Seat already taken" });
    }

    // 🔥 lock → booked
    await client.query("UPDATE seats SET status='booked' WHERE id = ANY($1)", [
      seats,
    ]);

    const booking = await client.query(
      `
      INSERT INTO bookings (user_id, flight_id, seat, status, created_at)
      VALUES ($1,$2,$3,'PENDING',NOW())
      RETURNING *
      `,
      [req.user.id, flightId, seats.join(",")],
    );

    // REALTIME PIPELINE
    io.to("admin-room").emit("new-booking", {
      type: "FLIGHT",
      booking,
    });

    await client.query("COMMIT");

    res.json(booking.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);
    res.status(500).json({ error: "Booking failed" });
  } finally {
    client.release();
  }
});

/* ================= TOUR LIST ================= */
app.get("/tours", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM tours ORDER BY id DESC");

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Tour fetch failed" });
  }
});
/* ================= TOUR BY ID ================= */
app.get("/tours/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT * FROM tours WHERE id = $1", [id]);

    if (!result.rows.length) {
      return res.status(404).json({ message: "Tour not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});
/* ================= TOUR BOOKING ================= */
app.post("/booking/tour", requireAuth, async (req: any, res: Response) => {
  try {
    const { tourId } = req.body;

    const booking = await pool.query(
      `
      INSERT INTO tour_bookings (user_id, tour_id, status, created_at)
      VALUES ($1,$2,'PENDING',NOW())
      RETURNING *
      `,
      [req.user.id, tourId],
    );

    io.to("admin-room").emit("new-booking", {
      type: "TOUR",
      booking,
    });

    res.json(booking.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Tour booking failed" });
  }
});
/* ================= PAYMENT ================= */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-04-22.dahlia",
});
app.post("/stripe/create-session", requireAuth, async (req: any, res) => {
  try {
    const { bookingId, amount, type } = req.body;

    if (!bookingId || !amount || !type) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // ✅ create payment record first
    await pool.query(
      `INSERT INTO payments (booking_id, amount, type, status, created_at)
       VALUES ($1,$2,$3,'PENDING', NOW())`,
      [bookingId, amount, type],
    );

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: type === "FLIGHT" ? "Flight Booking ✈️" : "Tour Booking 🏝️",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",

      // 🔥 deep link (Expo)
      success_url: `exp://127.0.0.1:19000/--/success?bookingId=${bookingId}`,
      cancel_url: `exp://127.0.0.1:19000/--/cancel`,

      metadata: {
        bookingId: String(bookingId),
        type: String(type),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.log("Stripe error:", err);
    res.status(500).json({ message: "Stripe failed" });
  }
});
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];

      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET as string,
      );

      if (event.type === "checkout.session.completed") {
        const session: any = event.data.object;

        const bookingId = session.metadata.bookingId;
        const type = session.metadata.type;

        // ✅ approve payment
        await pool.query(
          "UPDATE payments SET status='APPROVED' WHERE booking_id=$1",
          [bookingId],
        );

        // ✅ update booking
        if (type === "FLIGHT") {
          await pool.query(
            "UPDATE bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2",
            [`FL_${Date.now()}`, bookingId],
          );
        }

        if (type === "TOUR") {
          await pool.query(
            "UPDATE tour_bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2",
            [`TR_${Date.now()}`, bookingId],
          );
        }

        console.log("✅ PAYMENT SUCCESS:", bookingId);
      }

      res.json({ received: true });
    } catch (err) {
      console.log("❌ Webhook error:", err);
      res.status(400).send("Webhook Error");
    }
  },
);

/* ================= PAYMENT (CREATE) ================= */
app.post("/payment/flight", requireAuth, async (req: any, res) => {
  const client = await pool.connect();

  try {
    const { bookingId, amount, slip } = req.body;

    await client.query("BEGIN");

    // ❗ prevent duplicate payment
    const existing = await client.query(
      "SELECT * FROM payments WHERE booking_id=$1",
      [bookingId],
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Payment already exists" });
    }

    const payment = await client.query(
      `INSERT INTO payments (booking_id, amount, type, status, slip_url, created_at)
       VALUES ($1,$2,'FLIGHT','PENDING',$3,NOW())
       RETURNING *`,
      [bookingId, amount, slip || null],
    );

    await client.query("COMMIT");

    res.json({ success: true, payment: payment.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);
    res.status(500).json({ error: "Payment failed" });
  } finally {
    client.release();
  }
});

app.post("/payment/tour", requireAuth, async (req: any, res) => {
  const client = await pool.connect();

  try {
    const { bookingId, amount, slip } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT * FROM payments WHERE booking_id=$1",
      [bookingId],
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Payment already exists" });
    }

    const payment = await client.query(
      `INSERT INTO payments (booking_id, amount, type, status, slip_url, created_at)
       VALUES ($1,$2,'TOUR','PENDING',$3,NOW())
       RETURNING *`,
      [bookingId, amount, slip || null],
    );

    await client.query("COMMIT");

    res.json({ success: true, payment: payment.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);
    res.status(500).json({ error: "Payment failed" });
  } finally {
    client.release();
  }
});

/* ================= UPLOAD SLIP ================= */
app.post(
  "/payment/upload",
  requireAuth,
  upload.single("file"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const result = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "payment-slips",
      });

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

/* ================= GET PAYMENT ================= */
app.get("/payment/:bookingId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payments WHERE booking_id=$1",
      [req.params.bookingId],
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Fetch error" });
  }
});

/* ================= ADMIN APPROVE ================= */
app.post("/admin/approve-payment", requireAdmin, async (req: any, res) => {
  const client = await pool.connect();

  try {
    const { paymentId, bookingId, type, userId } = req.body;

    await client.query("BEGIN");

    await client.query("UPDATE payments SET status='APPROVED' WHERE id=$1", [
      paymentId,
    ]);

    const ticketCode = `TKT-${Date.now()}`;

    if (type === "FLIGHT") {
      await client.query(
        "UPDATE bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2",
        [ticketCode, bookingId],
      );
    }

    if (type === "TOUR") {
      await client.query(
        "UPDATE tour_bookings SET status='CONFIRMED', ticket_code=$1 WHERE id=$2",
        [ticketCode, bookingId],
      );
    }

    await pool.query(
      "UPDATE payments SET status='APPROVED' WHERE booking_id=$1",
      [paymentId],
    );

    io.to("admin-room").emit("payment-updated", {
      paymentId,
      status: "APPROVED",
    });

    await client.query("COMMIT");

    // 🔥 SOCKET PUSH
    const socketId = userSockets.get(userId);

    if (socketId) {
      io.to(socketId).emit("payment-approved", {
        bookingId,
        ticketCode,
        type,
      });
    }

    res.json({ success: true, ticketCode });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);
    res.status(500).json({ error: "Approval failed" });
  } finally {
    client.release();
  }
});

/* ================= CANCEL ================= */
app.post("/admin/cancel", requireAdmin, async (req: any, res) => {
  const client = await pool.connect();

  try {
    const { bookingId, type } = req.body;

    await client.query("BEGIN");

    if (type === "FLIGHT") {
      // 🔥 release seats
      await client.query(
        `
        UPDATE seats SET status='available'
        WHERE id IN (
          SELECT unnest(string_to_array(seat, ','))::int
          FROM bookings WHERE id=$1
        )
      `,
        [bookingId],
      );

      await client.query("UPDATE bookings SET status='CANCELLED' WHERE id=$1", [
        bookingId,
      ]);
    }

    if (type === "TOUR") {
      await client.query(
        "UPDATE tour_bookings SET status='CANCELLED' WHERE id=$1",
        [bookingId],
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);
    res.status(500).json({ error: "Cancel failed" });
  } finally {
    client.release();
  }
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

app.get("/ticket/pdf/:id", async (req, res) => {
  const booking = await pool.query("SELECT * FROM tour_bookings WHERE id=$1", [
    req.params.id,
  ]);

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");

  doc.fontSize(20).text("🎟 Tour Ticket", { align: "center" });
  doc.moveDown();

  doc.text(`Booking ID: ${booking.rows[0].id}`);
  doc.text(`Status: ${booking.rows[0].status}`);
  doc.text(`Ticket Code: ${booking.rows[0].ticket_code}`);

  doc.end();
  doc.pipe(res);
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

app.post("/save-token", requireAuth, async (req: any, res) => {
  const { token } = req.body;

  await pool.query("UPDATE users SET expo_token=$1 WHERE id=$2", [
    token,
    req.user.id,
  ]);

  res.json({ success: true });
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
app.get(
  "/admin/dashboard",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const users = await pool.query("SELECT COUNT(*) FROM users");
      const bookings = await pool.query("SELECT COUNT(*) FROM bookings");
      const tours = await pool.query("SELECT COUNT(*) FROM tour_bookings");
      const revenue = await pool.query(
        "SELECT SUM(amount) FROM payments WHERE status='APPROVED'",
      );

      res.json({
        users: users.rows[0].count,
        bookings: bookings.rows[0].count,
        tours: tours.rows[0].count,
        revenue: revenue.rows[0].sum || 0,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "dashboard error" });
    }
  },
);
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
    SELECT DATE(created_at) as day, SUM(amount)
    FROM payments
    WHERE status='APPROVED'
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) DESC
  `);

  const bookings = await pool.query(
    "SELECT DATE(created_at) as day, COUNT(*) FROM bookings GROUP BY DATE(created_at) ORDER BY DATE(created_at) DESC"
  
  );

  res.json({
    revenue: revenue.rows,
    bookings: bookings.rows,
  });
});
app.get("/admin/analytics/peak-hours", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as bookings
    FROM bookings
    GROUP BY hour
    ORDER BY bookings DESC
  `);

  res.json(result.rows);
});
app.get("/admin/analytics/user-behavior", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT 
      type,
      COUNT(*) as total
    FROM (
      SELECT 'FLIGHT' as type FROM bookings
      UNION ALL
      SELECT 'TOUR' as type FROM tour_bookings
    ) t
    GROUP BY type
  `);

  res.json(result.rows);
});
app.get("/admin/analytics/active-users", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT user_id) as active_users
    FROM bookings
    WHERE created_at > NOW() - INTERVAL '7 days'
  `);

  res.json(result.rows[0]);
});
app.get("/admin/revenue", requireAdmin, async (req, res) => {
  const result = await pool.query(
    "SELECT SUM(amount) FROM payments WHERE status='APPROVED'"
  );

  res.json({
    total: result.rows[0].sum || 0,
  });
});
app.get("/admin/revenue/daily", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT 
      DATE(created_at) as date,
      SUM(amount) as revenue
    FROM payments
    WHERE status='APPROVED'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);

  res.json(result.rows);
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
