import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME!,
  api_key: process.env.CLOUD_API_KEY!,
  api_secret: process.env.CLOUD_API_SECRET!,
});

// 📁 local storage first
export const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

export const upload = multer({ storage });

// ☁️ upload to cloudinary
export const uploadToCloudinary = async (filePath: string) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "tours",
  });

  fs.unlinkSync(filePath); // delete local file after upload

  return result;
};