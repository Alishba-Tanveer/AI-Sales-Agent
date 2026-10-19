import path from "node:path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { env } from "../config/env";

export async function sendOtpEmail(toEmail: string, otp: string): Promise<boolean> {
  // Reload .env dynamically so changes to SMTP_USER / SMTP_PASS take effect without manually restarting the server
  dotenv.config({
    path: path.resolve(__dirname, "../../../../.env"),
    override: true,
  });

  const smtpUser = (process.env.SMTP_USER || env.SMTP_USER)?.trim();
  const smtpPass = (process.env.SMTP_PASS || env.SMTP_PASS)?.replace(/\s+/g, ""); // automatically strip spaces from 16-char Google App Password

  if (!smtpUser || !smtpPass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `\n[MAILER WARNING] SMTP_USER or SMTP_PASS is missing in .env. Skipping real email delivery. OTP for ${toEmail}: ${otp}\n`
      );
    } else {
      console.warn(
        "\n[MAILER WARNING] SMTP_USER or SMTP_PASS is missing in .env. Skipping real email delivery.\n"
      );
    }
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"AI Sales Agent" <${smtpUser}>`,
    to: toEmail,
    subject: `${otp} is your AI Sales Agent password reset code`,
    text: `Your password reset OTP code is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request a password reset, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #0b0f19; color: #f8fafc;">
        <h2 style="margin-top: 0; color: #818cf8;">AI Sales Agent</h2>
        <p style="font-size: 15px; color: #cbd5e1;">Use the 6-digit verification code below to reset your password:</p>
        <div style="margin: 24px 0; padding: 16px; text-align: center; background-color: #111623; border: 1px solid #2a3350; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f8fafc;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
      </div>
    `,
  });

  console.log(`\n[MAILER] Successfully sent 6-digit OTP email to ${toEmail}\n`);
  return true;
}
