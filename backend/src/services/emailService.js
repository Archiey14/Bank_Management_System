const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

let customTransporter = null;

const setTransporter = (transporter) => {
  customTransporter = transporter;
};

const getTransporter = () => {
  if (customTransporter) {
    return customTransporter;
  }

  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || "587", 10);
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const transporter = getTransporter();
  const from =
    process.env.EMAIL_FROM ||
    `"Northbank Security" <${process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@northbank.com"}>`;

  const mailOptions = {
    from,
    to,
    subject: "Reset Your Banking Management System Password",
    text: `You recently requested to reset your password for your Northbank workspace account.\n\nPlease reset your password using the link below:\n${resetUrl}\n\nThis password reset link will expire in 15 minutes.\n\nIf you did not make this request, you can safely ignore this email and your password will remain unchanged.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 24px; color: #24292f; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #d0d7de; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .logo { font-size: 20px; font-weight: 700; color: #0969da; margin-bottom: 24px; display: inline-block; }
          h2 { margin-top: 0; color: #24292f; font-size: 20px; }
          p { font-size: 14px; line-height: 1.6; color: #57606a; margin: 16px 0; }
          .button-wrap { text-align: center; margin: 32px 0; }
          .button { background-color: #0969da; color: #ffffff !important; padding: 12px 24px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block; }
          .fallback { word-break: break-all; font-size: 12px; color: #57606a; background: #f6f8fa; padding: 12px; border-radius: 6px; }
          .footer { font-size: 12px; color: #8c959f; border-top: 1px solid #d0d7de; margin-top: 32px; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">Northbank</div>
          <h2>Reset your password</h2>
          <p>We received a request to reset the password for your Northbank banking workspace account. Click the button below to choose a new password.</p>
          <div class="button-wrap">
            <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
          </div>
          <p>This password reset link will expire in <strong>15 minutes</strong>.</p>
          <p>If you're having trouble with the button above, copy and paste the following link into your web browser:</p>
          <div class="fallback">${resetUrl}</div>
          <p>If you did not request a password reset, you can safely ignore this email. Your password will not change until you access the link above and create a new one.</p>
          <div class="footer">
            &copy; Northbank Management System. All rights reserved.<br>
            This is an automated security notice sent to protect your banking account.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

module.exports = {
  sendPasswordResetEmail,
  setTransporter,
};

