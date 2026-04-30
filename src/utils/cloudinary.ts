import cloudinary from "cloudinary";
import multer from "multer";

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME!,
  api_key: process.env.CLOUD_API_KEY!,
  api_secret: process.env.CLOUD_API_SECRET!,
});

// multer storage
export const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

export const uploadImage = multer({ storage });

export const uploadToCloudinary = async (filePath: string) => {
  return await cloudinary.v2.uploader.upload(filePath, {
    folder: "tours",
  } as any);
};