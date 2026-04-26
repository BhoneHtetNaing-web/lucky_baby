import QRCode from "qrcode";

export const generateTicketQR = async (bookingId: number) => {
  const qrData = `BOOKING:${bookingId}`;

  const qrImage = await QRCode.toDataURL(qrData);

  return qrImage;
};