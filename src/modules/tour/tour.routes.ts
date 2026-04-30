import express from "express";
import multer from "multer";
import { storage, uploadToCloudinary } from "../../utils/cloudinary.js";
import { pool } from "../../db.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage });

/* =========================
   GET ALL TOURS
========================= */
router.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM tours ORDER BY id DESC");
  res.json(result.rows);
});

/* =========================
   GET TOUR DETAIL
========================= */
router.get("/:id", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM tours WHERE id=$1",
    [req.params.id]
  );

  res.json(result.rows[0]);
});

/* =========================
   CREATE TOUR (ADMIN)
========================= */
router.post(
  "/create",
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    const { title, description, price, duration } = req.body;

    const image = req.file;
    if (!image) {
        return res.status(400).json({ error: "Image is required" });
    }

    const upload = await uploadToCloudinary(image.path);

    const result = await pool.query(
      `INSERT INTO tours (title, description, price, duration, image)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, description, price, duration, upload.secure_url]
    );

    res.json(result.rows[0]);
  }
);

/* =========================
   BOOK TOUR
========================= */
router.post("/book", async (req, res) => {
  const { tourId, userId } = req.body;

  const result = await pool.query(
    `INSERT INTO tour_bookings (tour_id, user_id)
     VALUES ($1,$2) RETURNING *`,
    [tourId, userId]
  );

  res.json(result.rows[0]);
});

/* =========================
   ADMIN APPROVE
========================= */
router.post("/approve", requireAdmin, async (req, res) => {
  const { bookingId } = req.body;

  await pool.query(
    "UPDATE tour_bookings SET status='CONFIRMED' WHERE id=$1",
    [bookingId]
  );

  res.json({ success: true });
});

export default router;