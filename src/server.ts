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
import { aiAgent } from "./ai/ai.agent.js";
import { aiLearning } from "./ai/learning-agent.js";
import { aiHistoryInsight } from "./ai/memory.js";
import fetch from "node-fetch";

dotenv.config();

const ok = (res: Response, data: any) => {
  return res.json({
    success: true,
    data,
  });
};

const fail = (
  res: Response,
  message: string = "Server Error",
  code: number = 500,
) => {
  return res.status(code).json({
    success: false,
    message,
  });
};

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

const onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.on("register-user", (userId) => {
    userSockets.set(userId, socket.id);
    onlineUsers.set(userId, socket.id);

    io.emit("users-online", Array.from(onlineUsers.keys()));
  });

  // when booking confirmed
  const notifyUser = (userId: string, message: string) => {
    const socketId = userSockets.get(userId);

    if (socketId) {
      io.to(socketId).emit("notification", {
        type: "BOOKING_CONFIRMED",
        message,
        time: new Date(),
      });
    }
  };

  socket.on("join-flight", (id) => {
    socket.join(`flight-${id}`);
  });

  socket.on("join-tour", (id) => {
    socket.join(`tour-${id}`);
  });

  socket.on("admin-join", () => {
    socket.join("admin-room");
  });

  socket.on("system-alert", (data) => {
    io.to("admin-room").emit("alert", {
      type: data.type,
      message: data.message,
      level: data.level || "info",
      time: new Date(),
    });
  });

  socket.on("join-map", () => {
    socket.join("world-map");
  });

  socket.on("disconnect", () => {
    for (let [userId, id] of userSockets.entries()) {
      if (id === socket.id) {
        userSockets.delete(userId);
        onlineUsers.delete(userId); // 🔥 IMPORTANT FIX
        break;
      }
    }

    io.emit("users-online", Array.from(onlineUsers.keys())); // 🔥 update
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
app.post("/ai/agent", requireAuth, aiAgent);
app.post("/ai/learning", aiLearning);
app.post("/ai/copilot", requireAuth, async (req: any, res: Response) => {
  try {
    const { message } = req.body;

    if (!process.env.OPENAI_KEY) {
      return res.status(500).json({
        reply: "❌ OPENAI KEY missing",
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: "You are a helpful travel assistant.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const text = await response.text(); // 🔥 important debug
    console.log("OPENAI RAW:", text);

    const data = JSON.parse(text);

    if (!response.ok) {
      return res.status(500).json({
        reply: data.error?.message || "OpenAI failed",
      });
    }

    return res.json({
      reply: data.choices?.[0]?.message?.content || "No reply",
    });

  } catch (err: any) {
    console.log("AI ERROR:", err.message);

    return res.status(500).json({
      reply: "⚠️ AI server crash",
    });
  }
});
app.post("/ai/history-insight", requireAuth, aiHistoryInsight);

/* ================= HEALTH ================= */
app.get("/", (req: Request, res: Response) => {
  res.send("🚀 FULL SYSTEM RUNNING");
});
// app.post("/admin/copilot", requireAdmin, async (req: any, res) => {
//   try {
//     const { message } = req.body;
//     const text = message.toLowerCase();

//     const run = async (q: string) => (await pool.query(q)).rows;

//     // =============================
//     // 📡 CONTEXT BUILDER
//     // =============================
//     let context: any = {};

//     if (text.includes("revenue")) {
//       context.revenue = await run(`
//         SELECT DATE(created_at) as date, SUM(amount)::int as total
//         FROM payments
//         WHERE status='APPROVED'
//         GROUP BY DATE(created_at)
//         ORDER BY date DESC
//         LIMIT 7
//       `);
//     }

//     if (text.includes("booking")) {
//       context.bookings = await run(`
//         SELECT COUNT(*)::int as total FROM bookings
//       `);
//     }

//     if (text.includes("user") || text.includes("top")) {
//       context.topUsers = await run(`
//         SELECT user_id, COUNT(*)::int as total
//         FROM bookings
//         GROUP BY user_id
//         ORDER BY total DESC
//         LIMIT 5
//       `);
//     }

//     if (text.includes("alert") || text.includes("problem")) {
//       context.recentErrors = await run(`
//         SELECT * FROM system_logs
//         ORDER BY created_at DESC
//         LIMIT 10
//       `);
//     }

//     // =============================
//     // 🤖 AI ANALYSIS ENGINE
//     // =============================
//     const response = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "gpt-4o-mini",
//         messages: [
//           {
//             role: "system",
//             content: `
// You are ADMIN AI COPILOT (NASA CONTROL ROOM SYSTEM).

// You must:
// - analyze system health
// - detect anomalies
// - summarize revenue trends
// - detect suspicious behavior
// - give alerts if needed

// Output style:
// - short
// - structured
// - operational
//               `,
//           },
//           {
//             role: "user",
//             content: `
// ADMIN QUERY: ${message}

// SYSTEM DATA:
// ${JSON.stringify(context)}
//               `,
//           },
//         ],
//       }),
//     });

//     const data = await response.json();

//     return res.json({
//       success: true,
//       reply: data?.choices?.[0]?.message?.content,
//     });
//   } catch (err) {
//     console.log("COPILOT ERROR:", err);

//     return res.status(500).json({
//       success: false,
//       reply: "Admin Copilot failed",
//     });
//   }
// });
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

    io.emit("new-booking", {
      type: "FLIGHT",
      flightId,
      seats,
      time: Date.now(),
    });

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
app.post("/visa/book", requireAuth, async (req: any, res: Response) => {
  try {
    const { visaType, data } = req.body;

    const result = await pool.query(
      `
      INSERT INTO visa_requests (user_id, visa_type, data, status, created_at)
      VALUES ($1,$2,$3,'PENDING',NOW())
      RETURNING *
      `,
      [req.user.id, visaType, JSON.stringify(data)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Visa booking failed" });
  }
});
app.get("/admin/visa-requests", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT v.*, u.name
    FROM visa_requests v
    JOIN users u ON v.user_id = u.id
    ORDER BY created_at DESC
  `);

  res.json(result.rows);
});
// =============================
// 🏝 GET ALL TOURS
// =============================
app.get("/tours", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, name, price, description, image
      FROM tours
      ORDER BY id DESC
    `);

    ok(res, result.rows);
  } catch (err) {
    console.error("GET /tours error:", err);
    fail(res, "Failed to fetch tours");
  }
});
/* ================= TOUR BY ID ================= */
app.get("/tours/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, "Invalid tour ID", 400);
    }

    const result = await pool.query(`SELECT * FROM tours WHERE id = $1`, [id]);

    if (!result.rows.length) {
      return fail(res, "Tour not found", 404);
    }

    ok(res, result.rows[0]);
  } catch (err) {
    console.error("GET /tours/:id error:", err);
    fail(res, "Server error");
  }
});
// =============================
// 🎫 BOOK TOUR
// =============================
app.post("/booking/tour", requireAuth, async (req: any, res: Response) => {
  try {
    const { tourId } = req.body;

    // ✅ VALIDATION
    if (!tourId) {
      return fail(res, "tourId is required", 400);
    }

    // ✅ CHECK TOUR EXISTS
    const tour = await pool.query(`SELECT * FROM tours WHERE id = $1`, [
      tourId,
    ]);

    if (!tour.rows.length) {
      return fail(res, "Tour not found", 404);
    }

    // ✅ CREATE BOOKING
    const booking = await pool.query(
      `
      INSERT INTO tour_bookings (user_id, tour_id, status, created_at)
      VALUES ($1,$2,'PENDING',NOW())
      RETURNING *
      `,
      [req.user.id, tourId],
    );

    const newBooking = booking.rows[0];

    // ✅ SOCKET EMIT (REAL-TIME ADMIN)
    if (typeof io !== "undefined") {
      io.to("admin-room").emit("new-booking", {
        type: "TOUR",
        booking: newBooking,
      });
    }
    ok(res, newBooking);
  } catch (err) {
    console.error("POST /booking/tour error:", err);
    fail(res, "Tour booking failed");
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
app.post("/admin/approve-payment", requireAdmin, async (req, res) => {
  try {
    const { paymentId, action } = req.body;
    // action: APPROVE | REJECT

    const payment = await pool.query(
      `SELECT * FROM payments WHERE id=$1`,
      [paymentId],
    );

    if (!payment.rows.length) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const p = payment.rows[0];

    // =====================
    // UPDATE PAYMENT STATUS
    // =====================
    const updated = await pool.query(
      `UPDATE payments
       SET status=$1
       WHERE id=$2
       RETURNING *`,
      [action === "APPROVE" ? "APPROVED" : "REJECTED", paymentId],
    );

    // =====================
    // AUTO UPDATE BOOKING
    // =====================
    if (action === "APPROVE") {
      if (p.type === "FLIGHT") {
        await pool.query(
          `UPDATE bookings SET status='CONFIRMED' WHERE id=$1`,
          [p.booking_id],
        );
      }

      if (p.type === "TOUR") {
        await pool.query(
          `UPDATE tour_bookings SET status='CONFIRMED' WHERE id=$1`,
          [p.booking_id],
        );
      }

      if (p.type === "VISA") {
        await pool.query(
          `UPDATE visa_bookings SET status='APPROVED' WHERE id=$1`,
          [p.booking_id],
        );
      }
    }

    return res.json({
      message: "Payment updated successfully",
      data: updated.rows[0],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Approve payment failed" });
  }
});
app.get("/admin/payments", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT
    p.*,
    u.email
    FROM payments p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
  `);

  res.json(result.rows);
});
app.get("/my-trips", requireAuth, async (req: any, res) => {
  try {
    const flights = await pool.query(
      `
      SELECT 
        b.id,
        'FLIGHT' as type,
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
      AND b.status = 'CONFIRMED'
      `,
      [req.user.id],
    );

    const tours = await pool.query(
      `
      SELECT 
        tb.id,
        'TOUR' as type,
        tb.status,
        tb.created_at,
        t.name,
        t.location
      FROM tour_bookings tb
      JOIN tours t ON tb.tour_id = t.id
      WHERE tb.user_id = $1
      AND tb.status = 'CONFIRMED'
      `,
      [req.user.id],
    );

    const trips = [...flights.rows, ...tours.rows];

    trips.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return res.json(trips);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "My trips error" });
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
  try {
    const { id } = req.params;

    const booking = await pool.query(`SELECT * FROM bookings WHERE id=$1`, [
      id,
    ]);

    if (!booking.rows.length) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const data = booking.rows[0];

    // DO NOT INSERT HERE ❌ (only fetch)
    // 🎯 QR payload
    const qrPayload = JSON.stringify({
      bookingId: data.id,
      flight: data.flight_id,
      seat: data.seat,
      status: data.status,
    });

    const qrCode = await QRCode.toDataURL(qrPayload);

    return res.json({
      id: data.id,
      flight_id: data.flight_id,
      seats: data.seat?.split(",") || [],
      status: data.status,
      ticket_code: data.ticket_code || `TKT-${data.id}`,
      qr: qrCode,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/ticket/pdf/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await pool.query(`SELECT * FROM bookings WHERE id=$1`, [
      id,
    ]);

    if (!booking.rows.length) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const data = booking.rows[0];

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=ticket-${id}.pdf`);

    doc.pipe(res);

    // 🎟 HEADER
    doc.fontSize(22).text("🎫 BOARDING PASS", {
      align: "center",
    });

    doc.moveDown(2);

    // ✈️ INFO BLOCK
    doc.fontSize(14);
    doc.text(`Booking ID: ${data.id}`);
    doc.text(`Flight ID: ${data.flight_id}`);
    doc.text(`Seats: ${data.seat}`);
    doc.text(`Status: ${data.status}`);
    doc.text(`Ticket Code: ${data.ticket_code || `TKT-${data.id}`}`);

    doc.moveDown(2);

    // 🧾 FOOTER
    doc
      .fontSize(10)
      .text(
        "This ticket is system-generated. Please show QR at airport gate.",
        {
          align: "center",
        },
      );

    doc.end();
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "PDF generation failed" });
  }
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
app.post("/admin/scan", requireAdmin, async (req, res) => {
  const { ticketId } = req.body;

  const ticket = await pool.query("SELECT * FROM bookings WHERE id=$1", [
    ticketId,
  ]);

  if (!ticket.rows.length) {
    return res.json({ valid: false, message: "❌ Invalid Ticket" });
  }

  if (ticket.rows[0].status === "CHECKED_IN") {
    return res.json({ valid: false, message: "⚠️ Already checked in" });
  }

  await pool.query("UPDATE bookings SET status='CHECKED_IN' WHERE id=$1", [
    ticketId,
  ]);

  res.json({
    valid: true,
    message: "✅ Boarding Approved",
  });
});
app.post("/admin/biometric-checkin", requireAdmin, async (req, res) => {
  const { ticketId, faceHash } = req.body;

  const ticket = await pool.query("SELECT * FROM bookings WHERE id=$1", [
    ticketId,
  ]);

  if (!ticket.rows.length) {
    return res.json({ ok: false, message: "Invalid Ticket" });
  }

  const userFace = await pool.query("SELECT face_hash FROM users WHERE id=$1", [
    ticket.rows[0].user_id,
  ]);

  // simple match simulation
  const match = userFace.rows[0]?.face_hash === faceHash;

  if (!match) {
    return res.json({
      ok: false,
      message: "Face mismatch ❌",
    });
  }

  await pool.query("UPDATE bookings SET status='CHECKED_IN' WHERE id=$1", [
    ticketId,
  ]);

  res.json({
    ok: true,
    message: "✅ Biometric Check-in Approved",
  });
});
/* ================= HISTORY =================== */
app.get("/history", requireAuth, async (req: any, res) => {
  try {
    const flights = await pool.query(
      `
      SELECT 
        b.id,
        'flight' as type,
        f.from_city || ' → ' || f.to_city as title,
        b.status,
        b.created_at
      FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      WHERE b.user_id=$1
      `,
      [req.user.id],
    );

    const tours = await pool.query(
      `
      SELECT 
        tb.id,
        'tour' as type,
        t.name as title,
        tb.status,
        tb.created_at
      FROM tour_bookings tb
      JOIN tours t ON tb.tour_id = t.id
      WHERE tb.user_id=$1
      `,
      [req.user.id],
    );

    const merged = [...flights.rows, ...tours.rows];

    merged.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    res.json(merged);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "History failed" });
  }
});
/* ================= ADMIN STATS ================= */
app.get("/admin/live-stats", requireAdmin, async (req, res) => {
  const revenue = await pool.query(`
    SELECT COALESCE(SUM(amount),0) as revenue
    FROM payments WHERE status='APPROVED'
  `);

  const bookings = await pool.query(`
    SELECT COUNT(*) FROM bookings
  `);

  const users = await pool.query(`
    SELECT COUNT(*) FROM users
  `);

  res.json({
    revenue: revenue.rows[0].revenue,
    bookings: bookings.rows[0].count,
    users: users.rows[0].count,
  });
});
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
app.get("/admin/dashboard", requireAdmin, async (req: any, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM bookings) as flight_bookings,
        (SELECT COUNT(*) FROM tour_bookings) as tour_bookings,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='APPROVED') as revenue
    `);

    ok(res, result.rows[0]);
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    fail(res, "Dashboard fetch failed");
  }
});
app.get("/admin/full-bookings", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        'FLIGHT' as type,
        b.status,
        b.seat,
        b.ticket_code,
        u.email,
        f.from_city,
        f.to_city,
        COALESCE(p.status, 'UNPAID') as payment_status,
        b.created_at
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN flights f ON b.flight_id = f.id
      LEFT JOIN payments p ON p.booking_id = b.id

      UNION ALL

      SELECT 
        tb.id,
        'TOUR' as type,
        tb.status,
        NULL as seat,
        tb.ticket_code,
        u.email,
        NULL,
        NULL,
        COALESCE(p.status, 'UNPAID'),
        tb.created_at
      FROM tour_bookings tb
      JOIN users u ON tb.user_id = u.id
      JOIN tours t ON tb.tour_id = t.id
      LEFT JOIN payments p ON p.booking_id = tb.id

      ORDER BY created_at DESC
    `);

    ok(res, result.rows);
  } catch (err) {
    console.error(err);
    fail(res, "Failed to fetch bookings");
  }
});
app.get("/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const revenue = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount)::int as revenue
      FROM payments
      WHERE status='APPROVED'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const bookings = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::int as bookings
      FROM bookings
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    ok(res, {
      revenue: revenue.rows,
      bookings: bookings.rows,
    });
  } catch (err) {
    console.error(err);
    fail(res, "Analytics error");
  }
});
app.get("/admin/analytics/peak-hours", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*)::int as total
      FROM bookings
      GROUP BY hour
      ORDER BY total DESC
    `);

    ok(res, result.rows);
  } catch (err) {
    fail(res, "Peak hours error");
  }
});
app.get("/admin/analytics/user-behavior", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        type,
        COUNT(*)::int as total
      FROM (
        SELECT 'FLIGHT' as type FROM bookings
        UNION ALL
        SELECT 'TOUR' as type FROM tour_bookings
      ) t
      GROUP BY type
    `);

    ok(res, result.rows);
  } catch {
    fail(res, "Behavior error");
  }
});
app.get("/admin/analytics/active-users", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(DISTINCT user_id)::int as active_users
      FROM bookings
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    ok(res, result.rows[0]);
  } catch {
    fail(res, "Active users error");
  }
});
app.get("/my-bookings", requireAuth, async (req: any, res) => {
  try {
    const result = await pool.query(
      `
SELECT * FROM (
  SELECT 
    b.id,
    'FLIGHT' as type,
    b.status,
    b.seat,
    b.ticket_code,
    b.created_at,
    f.from_city,
    f.to_city
  FROM bookings b
  JOIN flights f ON b.flight_id = f.id
  WHERE b.user_id = $1

  UNION ALL

  SELECT 
    tb.id,
    'TOUR' as type,
    tb.status,
    NULL as seat,
    tb.ticket_code,
    tb.created_at,
    NULL as from_city,
    t.name as to_city
  FROM tour_bookings tb
  JOIN tours t ON tb.tour_id = t.id
  WHERE tb.user_id = $1
) all_data
ORDER BY created_at DESC
    `,
      [req.user.id],
    );

    ok(res, result.rows);
  } catch {
    fail(res, "My bookings error");
  }
});
app.get("/admin/revenue", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        DATE(created_at) as x,
        SUM(amount)::int as y
      FROM payments
      WHERE status='APPROVED'
      GROUP BY DATE(created_at)
      ORDER BY x ASC
    `);

    ok(res, result.rows);
  } catch (err) {
    fail(res, "Revenue error");
  }
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
