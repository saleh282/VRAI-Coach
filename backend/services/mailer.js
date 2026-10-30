const nodemailer = require("nodemailer");

let transporter;

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const SUBJECTS = {
  verify_email: "Your VRAI verification code",
  reset_password: "Your VRAI password reset code",
};

const INTROS = {
  verify_email: "Use this code to confirm your email and finish creating your VRAI account.",
  reset_password: "Use this code to reset your VRAI password. If you did not ask for this, ignore this email.",
};

// Send a one-time code. Without SMTP settings (local development) the code is
// printed to the server console instead, so the flow can still be tested.
const sendOtpEmail = async ({ to, name, code, purpose, expiresInMinutes }) => {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured");
    }
    console.log(`[mailer] SMTP not configured. ${purpose} code for ${to}: ${code}`);
    return { delivered: false, logged: true };
  }

  const intro = INTROS[purpose];
  const greeting = name ? `Hi ${name},` : "Hi,";
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: SUBJECTS[purpose],
    text: `${greeting}\n\n${intro}\n\nCode: ${code}\n\nIt expires in ${expiresInMinutes} minutes.\n\n— VRAI Coach`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f2140">
      <h2 style="color:#1a73f0;letter-spacing:4px;font-weight:400">VRAI</h2>
      <p>${greeting}</p><p>${intro}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#eaf2ff;padding:16px;text-align:center;border-radius:12px">${code}</p>
      <p style="color:#6a7a93">It expires in ${expiresInMinutes} minutes.</p></div>`,
  });
  return { delivered: true, logged: false };
};

module.exports = { sendOtpEmail, smtpConfigured };
