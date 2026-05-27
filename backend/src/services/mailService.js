// E-mail service.
// Suporta dois provedores:
//   1. SMTP (Nodemailer): defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
//      Funciona com Gmail (App Password), Outlook, Yahoo, qualquer SMTP.
//   2. Resend (HTTP): defina RESEND_API_KEY e EMAIL_FROM.
// Se nenhum estiver configurado, isEmailConfigured() retorna false e o app
// cai no fallback de mostrar o código na tela.

let nodemailer = null;
let cachedTransporter = null;

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

function isEmailConfigured() {
  return hasSmtpConfig() || hasResendConfig();
}

function getDefaultFrom() {
  return process.env.EMAIL_FROM
    || (hasSmtpConfig() ? `SmartBudget <${process.env.SMTP_USER}>` : 'SmartBudget <onboarding@resend.dev>');
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!hasSmtpConfig()) return null;

  if (!nodemailer) {
    nodemailer = require('nodemailer');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

async function sendViaSmtp({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    await transporter.sendMail({
      from: getDefaultFrom(),
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      text,
      html: html || undefined,
    });
    return true;
  } catch (err) {
    console.error('[email][smtp] Falha ao enviar:', err.message);
    return false;
  }
}


async function sendViaResend({ to, subject, text, html }) {
  if (!hasResendConfig()) return false;

  try {
    const response = await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: getDefaultFrom(),
          to: Array.isArray(to) ? to : [to],
          subject,
          text,
          html: html || undefined,
        }),
      },
      8000
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('[email][resend] Recusado:', response.status, errBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email][resend] Erro:', err.message);
    return false;
  }
}

async function sendEmail(payload) {
  // SMTP tem prioridade (mais confiável e funciona para qualquer destinatário)
  if (hasSmtpConfig()) {
    const ok = await sendViaSmtp(payload);
    if (ok) return true;
    // Se SMTP falhou e tem Resend, tenta o fallback
  }

  if (hasResendConfig()) {
    return sendViaResend(payload);
  }

  return false;
}

function buildResetPasswordEmail({ name, code }) {
  const greeting = name ? `Olá, ${name}` : 'Olá';
  const text = [
    `${greeting}.`,
    '',
    'Recebemos uma solicitação de recuperação de senha para a sua conta SmartBudget.',
    '',
    `Seu código: ${code}`,
    '',
    'Esse código é válido por 30 minutos.',
    '',
    'Se não foi você, ignore este e-mail. Sua senha continua a mesma.',
    '',
    '— Equipe SmartBudget',
  ].join('\n');

  const html = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f6f8fb;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;width:100%;background:#ffffff;border-radius:18px;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <tr>
              <td align="center" style="padding:36px 36px 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" valign="middle" width="68" height="68" style="width:68px;height:68px;background:#10b981;background-image:linear-gradient(135deg,#10b981,#0d9488);border-radius:20px;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;text-align:center;line-height:68px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">SB</td>
                  </tr>
                </table>
                <div style="margin-top:14px;font-size:20px;font-weight:700;color:#0f172a;">SmartBudget</div>
                <div style="margin-top:4px;font-size:13px;color:#64748b;">Seu controle financeiro inteligente</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 36px 36px;">
                <h1 style="font-size:20px;color:#0f172a;margin:0 0 10px;text-align:center;font-weight:700;">Recuperação de senha</h1>
                <p style="color:#475569;line-height:1.6;margin:0 0 22px;text-align:center;font-size:14px;">${greeting}, use o código abaixo para definir uma nova senha.<br/>Ele é válido por <strong style="color:#0f172a;">30 minutos</strong>.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:20px;letter-spacing:8px;font-weight:800;font-size:28px;color:#065f46;font-family:-apple-system,Segoe UI,Roboto,Menlo,monospace;">${code}</td>
                  </tr>
                </table>
                <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0;text-align:center;">Se não foi você que solicitou, ignore este e-mail. Sua senha continua a mesma.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 36px 28px;">
                <div style="font-size:12px;color:#94a3b8;">— Equipe SmartBudget</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return { text, html };
}

module.exports = {
  isEmailConfigured,
  sendEmail,
  buildResetPasswordEmail,
};
