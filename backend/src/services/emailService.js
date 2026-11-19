const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

let customTransporter = null;

const setTransporter = (transporter) => {
  customTransporter = transporter;
};

// True when real SMTP credentials are configured. When false (and no test
// transporter has been injected) the login-OTP email is logged instead of sent
// so the flow still works on a dev machine without an email provider.
const hasSmtpConfig = () =>
  Boolean(
    process.env.EMAIL_USER ||
      process.env.SMTP_USER ||
      process.env.EMAIL_PASS ||
      process.env.SMTP_PASS
  );

const getTransporter = () => {
  if (customTransporter) {
    return customTransporter;
  }

  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || "587", 10);
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
  const pass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || "").replace(/\s+/g, "");

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

// Email the 6-digit sign-in code for the second step of login.
// Along with email delivery, the OTP is printed to the backend console so demo
// accounts and developers can immediately access the code from the server logs.
const sendLoginOtpEmail = async ({ to, code }) => {
  logger.info(`[2FA OTP] Sign-in code for ${to}: ${code} (expires in 5 minutes)`);

  if (customTransporter) {
    return customTransporter.sendMail(buildOtpMailOptions({ to, code }));
  }
  if (!hasSmtpConfig()) {
    logger.info("Configure EMAIL_USER / EMAIL_PASS to send real sign-in codes via email.");
    return { messageId: "dev-otp-log", devCode: code };
  }
  const transporter = getTransporter();
  return transporter.sendMail(buildOtpMailOptions({ to, code }));
};

const buildOtpMailOptions = ({ to, code }) => ({
  from:
    process.env.EMAIL_FROM ||
    `"Northbank Security" <${process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@northbank.com"}>`,
  to,
  subject: "Your Northbank sign-in code",
  text: `Your Northbank verification code is ${code}.\n\nUse it to finish signing in. The code expires in 5 minutes and can only be used once.\n\nIf you did not try to sign in, you can ignore this email — your account is safe.`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 24px; color: #24292f; }
        .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #d0d7de; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-align: center; }
        .logo { font-size: 20px; font-weight: 700; color: #0969da; margin-bottom: 24px; display: inline-block; }
        h2 { margin-top: 0; color: #24292f; font-size: 20px; }
        .code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0969da; padding: 16px 0; }
        p { font-size: 14px; line-height: 1.6; color: #57606a; margin: 12px 0; }
        .footer { font-size: 12px; color: #8c959f; border-top: 1px solid #d0d7de; margin-top: 24px; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Northbank</div>
        <h2>Your sign-in code</h2>
        <p>Enter this code to finish signing in. It expires in 5 minutes and works once.</p>
        <div class="code">${code}</div>
        <p>If you did not try to sign in, you can ignore this email — your account is safe.</p>
        <div class="footer">&copy; Northbank Management System. All rights reserved.</div>
      </div>
    </body>
    </html>
  `,
});

const sendCardApprovalEmail = async ({ to, recipientName, cardType, last4, pin, limit }) => {
  const cardLabel = cardType === "debit" ? "Debit" : "Credit";
  logger.info(
    `[CARD APPROVAL] ${cardLabel} Card ending in ${last4} approved for ${to} (${recipientName}). Generated PIN: ${pin}`
  );

  const mailOptions = buildCardApprovalMailOptions({
    to,
    recipientName: recipientName || "Valued Customer",
    cardType,
    cardLabel,
    last4,
    pin,
    limit,
  });

  if (customTransporter) {
    return customTransporter.sendMail(mailOptions);
  }
  if (!hasSmtpConfig()) {
    logger.info("Configure EMAIL_USER / EMAIL_PASS to send card approval emails via SMTP.");
    return { messageId: "dev-card-approval-log", devPin: pin };
  }
  const transporter = getTransporter();
  return transporter.sendMail(mailOptions);
};

const buildCardApprovalMailOptions = ({ to, recipientName, cardLabel, last4, pin, limit }) => {
  const from =
    process.env.EMAIL_FROM ||
    `"Northbank Cards" <${process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@northbank.com"}>`;

  const text = `Congratulations ${recipientName}!\n\nYour Northbank ${cardLabel} Card application has been approved and your card is now issued!\n\nCard Details:\n• Type: ${cardLabel} Card\n• Card Number: •••• ${last4}\n${limit ? `• Credit Limit: ₹${(limit / 100).toLocaleString("en-IN")}\n` : ""}• System-Generated PIN: ${pin}\n\nImportant Security Notice:\nKeep your PIN confidential. Do not share it with anyone. You can also update or change your card PIN at any time directly through your Northbank workspace under Card Settings.\n\nThank you for choosing Northbank!`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 24px; color: #24292f; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #d0d7de; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .logo { font-size: 22px; font-weight: 800; color: #0969da; margin-bottom: 20px; display: inline-block; letter-spacing: -0.5px; }
        .badge { display: inline-block; padding: 4px 12px; background: #dafbe1; color: #1a7f37; border: 1px solid #aceebb; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
        h2 { margin-top: 0; color: #1f2328; font-size: 22px; font-weight: 700; line-height: 1.3; }
        p { font-size: 14px; line-height: 1.6; color: #57606a; margin: 12px 0; }
        .card-details { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
        .card-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .card-row:last-child { margin-bottom: 0; }
        .card-label { color: #656d76; }
        .card-val { font-weight: 600; color: #1f2328; }
        .pin-box { background: #f0f7ff; border: 2px dashed #0969da; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }
        .pin-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #0969da; font-weight: 600; margin-bottom: 6px; }
        .pin-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0969da; }
        .security-box { background: #fff8c5; border: 1px solid #d4a72c; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #634f00; margin-top: 16px; line-height: 1.5; }
        .footer { font-size: 12px; color: #8c959f; border-top: 1px solid #d0d7de; margin-top: 28px; padding-top: 16px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Northbank</div>
        <div><span class="badge">Application Approved</span></div>
        <h2>Congratulations, ${recipientName}!</h2>
        <p>Your <strong>Northbank ${cardLabel} Card</strong> application has been successfully reviewed and approved by our banking team. Your card is active and ready to use.</p>
        
        <div class="card-details">
          <div class="card-row"><span class="card-label">Card Type:</span> <span class="card-val">${cardLabel} Card</span></div>
          <div class="card-row"><span class="card-label">Card Number:</span> <span class="card-val">•••• •••• •••• ${last4}</span></div>
          ${limit ? `<div class="card-row"><span class="card-label">Approved Limit:</span> <span class="card-val">₹${(limit / 100).toLocaleString("en-IN")}</span></div>` : ""}
        </div>

        <div class="pin-box">
          <div class="pin-label">Your Generated Card PIN</div>
          <div class="pin-code">${pin}</div>
        </div>

        <div class="security-box">
          <strong>Security Notice:</strong> Keep this PIN secret. You can also change your PIN anytime directly on the Northbank website under your card options.
        </div>

        <div class="footer">
          &copy; Northbank Core Management System. This is an official transactional message.
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from,
    to,
    subject: `Congratulations! Your Northbank ${cardLabel} Card has been approved`,
    text,
    html,
  };
};

const sendCardRejectionEmail = async ({ to, recipientName, cardType, applicationNumber, remarks }) => {
  const cardLabel = cardType === "debit" ? "Debit" : "Credit";
  logger.info(
    `[CARD REJECTION] ${cardLabel} Card application ${applicationNumber} rejected for ${to} (${recipientName}). Reason: ${remarks}`
  );

  const mailOptions = buildCardRejectionMailOptions({
    to,
    recipientName: recipientName || "Valued Customer",
    cardLabel,
    applicationNumber,
    remarks,
  });

  if (customTransporter) {
    return customTransporter.sendMail(mailOptions);
  }
  if (!hasSmtpConfig()) {
    logger.info("Configure EMAIL_USER / EMAIL_PASS to send card rejection emails via SMTP.");
    return { messageId: "dev-card-rejection-log", devRemarks: remarks };
  }
  const transporter = getTransporter();
  return transporter.sendMail(mailOptions);
};

const buildCardRejectionMailOptions = ({ to, recipientName, cardLabel, applicationNumber, remarks }) => {
  const from =
    process.env.EMAIL_FROM ||
    `"Northbank Cards" <${process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@northbank.com"}>`;

  const text = `Dear ${recipientName},\n\nWe regret to inform you that unfortunately your Northbank ${cardLabel} Card application (${applicationNumber}) has been rejected by our verification team.\n\nReason / Bank Remarks:\n"${remarks}"\n\nIf you have any questions or wish to re-apply after addressing the above remarks, you can submit a new application through your Northbank workspace or contact our support team.\n\nThank you for choosing Northbank.\nNorthbank Core Management System`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 24px; color: #24292f; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #d0d7de; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .logo { font-size: 22px; font-weight: 800; color: #0969da; margin-bottom: 20px; display: inline-block; letter-spacing: -0.5px; }
        .badge { display: inline-block; padding: 4px 12px; background: #ffebe9; color: #cf222e; border: 1px solid #ff8182; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
        h2 { margin-top: 0; color: #1f2328; font-size: 22px; font-weight: 700; line-height: 1.3; }
        p { font-size: 14px; line-height: 1.6; color: #57606a; margin: 12px 0; }
        .card-details { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
        .card-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .card-row:last-child { margin-bottom: 0; }
        .card-label { color: #656d76; }
        .card-val { font-weight: 600; color: #1f2328; }
        .remarks-box { background: #fff8f8; border-left: 4px solid #cf222e; border-radius: 4px; padding: 14px 18px; margin: 20px 0; }
        .remarks-label { font-size: 12px; text-transform: uppercase; font-weight: 700; color: #cf222e; margin-bottom: 4px; }
        .remarks-text { font-size: 14px; color: #24292f; font-style: italic; }
        .next-steps { font-size: 13px; color: #57606a; line-height: 1.5; margin-top: 20px; }
        .footer { font-size: 12px; color: #8c959f; border-top: 1px solid #d0d7de; margin-top: 28px; padding-top: 16px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Northbank</div>
        <div><span class="badge">Application Rejected</span></div>
        <h2>Dear ${recipientName},</h2>
        <p>Thank you for your interest in Northbank card services. We regret to inform you that unfortunately your <strong>Northbank ${cardLabel} Card</strong> application has been rejected by our verification team.</p>
        
        <div class="card-details">
          <div class="card-row"><span class="card-label">Card Type:</span> <span class="card-val">${cardLabel} Card</span></div>
          <div class="card-row"><span class="card-label">Application Reference:</span> <span class="card-val">${applicationNumber}</span></div>
        </div>

        <div class="remarks-box">
          <div class="remarks-label">Reason / Bank Remarks</div>
          <div class="remarks-text">"${remarks}"</div>
        </div>

        <p class="next-steps">
          If you have resolved the above issue or have updated documents, you are welcome to submit a fresh application at any time through your Northbank dashboard.
        </p>

        <div class="footer">
          &copy; Northbank Core Management System. This is an automated official service notice.
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from,
    to,
    subject: `Notice: Your Northbank ${cardLabel} Card Application Has Been Rejected`,
    text,
    html,
  };
};

module.exports = {
  sendPasswordResetEmail,
  sendLoginOtpEmail,
  sendCardApprovalEmail,
  sendCardRejectionEmail,
  setTransporter,
};

