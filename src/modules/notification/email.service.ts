import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendTicketEmail = async (
  to: string,
  qrImage: string
) => {
  await transporter.sendMail({
    from: "Lucky Treasure ✈️",
    to,
    subject: "Your Flight Ticket 🎫",
    html: `
      <h2>Your booking is confirmed!</h2>
      <p>Show this QR at airport:</p>
      <img src="${qrImage}" />
    `,
  });
};