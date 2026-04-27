import QRCode from "qrcode";

export const generateQRCode = async (text: string) => {
  return await QRCode.toDataURL(text);
};