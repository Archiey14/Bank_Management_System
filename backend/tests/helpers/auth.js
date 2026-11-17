// Shared helpers for the integration tests that need to complete the email-OTP
// sign-in flow. Tests inject a capturing transporter (see emailService.setTransporter)
// and these helpers pull the 6-digit code back out of the recorded email.
const CODE_RE = /code is[:\s]*([0-9]{6})/i;
const ANY_SIX_RE = /\b([0-9]{6})\b/;

const extractOtp = (mail) => {
  if (!mail) return null;
  const text = `${mail.subject || ""}\n${mail.text || ""}\n${mail.html || ""}`;
  const m = text.match(CODE_RE) || text.match(ANY_SIX_RE);
  return m ? m[1] : null;
};

// Runs the full two-step sign-in against the running server and returns the
// session token + user. `sentEmails` is the array the capturing transporter
// appends to (one mail option object per send).
const loginWithOtp = async (baseUrl, email, password, sentEmails) => {
  const before = sentEmails.length;
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.otpToken) {
    throw new Error(`login did not request OTP (${loginRes.status}): ${JSON.stringify(loginData)}`);
  }

  const otpMail = sentEmails.slice(before).reverse().find((m) => extractOtp(m));
  const code = extractOtp(otpMail);
  if (!code) throw new Error(`No OTP found in emails for ${email}`);

  const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otpToken: loginData.otpToken, code }),
  });
  const verifyData = await verifyRes.json();
  if (verifyRes.status !== 200 || !verifyData.token) {
    throw new Error(`OTP verify failed (${verifyRes.status}): ${JSON.stringify(verifyData)}`);
  }
  return { token: verifyData.token, user: verifyData.user };
};

module.exports = { extractOtp, loginWithOtp };
