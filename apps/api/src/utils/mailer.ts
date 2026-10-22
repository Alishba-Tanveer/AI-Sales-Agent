import path from "node:path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { env } from "../config/env";

function getSmtpCredentials() {
  dotenv.config({
    path: path.resolve(__dirname, "../../../../.env"),
    override: true,
  });

  const smtpUser = (process.env.SMTP_USER || env.SMTP_USER)?.trim();
  const smtpPass = (process.env.SMTP_PASS || env.SMTP_PASS)?.replace(/\s+/g, "");
  return { smtpUser, smtpPass };
}

export async function sendOtpEmail(toEmail: string, otp: string): Promise<boolean> {
  const { smtpUser, smtpPass } = getSmtpCredentials();

  if (!smtpUser || !smtpPass) {
    console.warn(
      `\n[MAILER WARNING] SMTP_USER or SMTP_PASS is missing in .env. Skipping real email delivery. OTP for ${toEmail}: ${otp}\n`
    );
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

export interface TeamInviteEmailParams {
  toEmail: string;
  inviterName: string;
  organizationName: string;
  role: string;
  token: string;
}

export async function sendTeamInviteEmail(params: TeamInviteEmailParams): Promise<boolean> {
  const { smtpUser, smtpPass } = getSmtpCredentials();

  if (!smtpUser || !smtpPass) {
    console.warn(
      `\n[MAILER WARNING] SMTP_USER or SMTP_PASS missing. Cannot send team invite email to ${params.toEmail}. Token: ${params.token}\n`
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const webUrl = (process.env.WEB_URL || env.WEB_URL || "http://localhost:3000").replace(/\/$/, "");
  const inviteLink = `${webUrl}/signup?inviteToken=${encodeURIComponent(params.token)}&email=${encodeURIComponent(params.toEmail)}`;

  await transporter.sendMail({
    from: `"AI Sales Agent" <${smtpUser}>`,
    to: params.toEmail,
    subject: `${params.inviterName} invited you to join ${params.organizationName} on AI Sales Agent`,
    text: `${params.inviterName} has invited you to join ${params.organizationName} as a ${params.role} on AI Sales Agent.\n\nAccept your invitation here:\n${inviteLink}\n\nThis invitation expires in 7 days.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #2a3350; border-radius: 14px; background-color: #0b0f19; color: #f8fafc;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #818cf8; font-size: 22px;">AI Sales Agent</h2>
        </div>
        <p style="font-size: 16px; line-height: 1.5; color: #e2e8f0; margin-bottom: 8px;">
          <strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> as a <strong>${params.role}</strong>.
        </p>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px;">
          Collaborate on AI-powered prospecting, multichannel sequences, and approval pipelines in real-time.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${inviteLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
            Accept Invitation &amp; Join Workspace
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.4; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${inviteLink}" style="color: #818cf8; word-break: break-all;">${inviteLink}</a>
        </p>
        <p style="font-size: 12px; color: #64748b; margin-top: 12px;">
          This invitation will expire in <strong>7 days</strong>. If you were not expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  console.log(`\n[MAILER] Successfully sent Team Invitation email to ${params.toEmail}\n`);
  return true;
}
