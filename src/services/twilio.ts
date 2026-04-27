import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_SID!,
  process.env.TWILIO_AUTH!
);

export const sendSMS = async (to: string, message: string) => {
  try {
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_NUMBER!,
    to,
  });

  console.log("SMS sent to:", to);
  } catch (err) {
    console.error("Twilio error:", err);
    throw new Error("SMS sending failed");
  }
};