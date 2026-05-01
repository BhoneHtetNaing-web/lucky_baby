import { pool } from "../../db.js";
import { uploadToCloudinary } from "../../utils/cloudinary.js";
import { Request, Response } from "express";

// ✅ CREATE TOUR (ADMIN)
export const createTour = async (req: Request, res: Response) => {
  try {
    const { name, location, price, description } = req.body;

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No image" });

    const upload = await uploadToCloudinary(file.path);

    const result = await pool.query(
      `INSERT INTO tours (name, location, price, description, image)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, location, price, description, upload.secure_url]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "create tour failed" });
  }
};

// ✅ GET ALL TOURS
export const getTours = async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM tours ORDER BY id DESC");
  res.json(result.rows);
};

// ✅ GET SINGLE TOUR
export const getTourById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await pool.query("SELECT * FROM tours WHERE id=$1", [id]);

  res.json(result.rows[0]);
};