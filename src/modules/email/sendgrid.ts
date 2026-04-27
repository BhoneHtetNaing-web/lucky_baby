import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendOTPEmail = async (email: string, code: string) => {
  await sgMail.send({
    to: email,
    from: process.env.EMAIL_FROM!,
    subject: "Your OTP Code",
    html: `
      <div style="font-family:Arial">
        <h2>Your OTP Code</h2>
        <p style="font-size:20px"><b>${code}</b></p>
        <p>This code expires in 5 minutes.</p>
      </div>
    `,
  });
};