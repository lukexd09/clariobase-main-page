const MAX_LENGTHS = {
  name: 120,
  email: 160,
  url: 500,
  city: 120,
  serviceType: 160,
  message: 3000
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (res, status, payload) => {
  res.status(status).json(payload);
};

const normalize = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const exceedsLimit = (value, maxLength) => typeof value === "string" && value.trim().length > maxLength;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;

  try {
    return JSON.parse(req.body);
  } catch (error) {
    return {};
  }
};

const verifyTurnstile = async (token, remoteIp) => {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret || !token) {
    return false;
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return Boolean(result.success);
};

const sendEmail = async ({ name, email, url, city, serviceType, message }) => {
  const requiredEnv = ["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length) {
    throw new Error("Missing email configuration");
  }

  const sentAt = new Date().toLocaleString("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw"
  });

  const rows = [
    ["Imię", name],
    ["Email", email],
    ["Link", url],
    ["Miasto", city || "Nie podano"],
    ["Rodzaj usług beauty", serviceType || "Nie podano"],
    ["Wiadomość", message],
    ["Data wysłania", sentAt],
    ["Źródło", "Formularz mini-audytu ClarioBase"]
  ];

  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n\n");
  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <th align="left" style="padding:8px 12px;border-bottom:1px solid #eaded0;color:#3a2923;">${escapeHtml(label)}</th>
          <td style="padding:8px 12px;border-bottom:1px solid #eaded0;color:#3a2923;">${escapeHtml(value).replaceAll("\n", "<br>")}</td>
        </tr>`
    )
    .join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL,
      to: [process.env.CONTACT_TO_EMAIL],
      reply_to: email,
      subject: "Nowy mini-audyt ClarioBase",
      text,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#3a2923;">
          <h1 style="font-size:22px;margin:0 0 16px;">Nowy mini-audyt ClarioBase</h1>
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px;background:#fffaf2;border:1px solid #eaded0;">
            ${htmlRows}
          </table>
        </div>`
    })
  });

  if (!response.ok) {
    throw new Error("Resend request failed");
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false });
  }

  try {
    const body = parseBody(req);

    if (String(body.companyWebsite || "").trim()) {
      return json(res, 200, { ok: true });
    }

    const hasTooLongField = Object.entries(MAX_LENGTHS).some(([field, maxLength]) =>
      exceedsLimit(body[field], maxLength)
    );

    if (hasTooLongField) {
      return json(res, 400, { ok: false });
    }

    const data = {
      name: normalize(body.name, MAX_LENGTHS.name),
      email: normalize(body.email, MAX_LENGTHS.email),
      url: normalize(body.url, MAX_LENGTHS.url),
      city: normalize(body.city, MAX_LENGTHS.city),
      serviceType: normalize(body.serviceType, MAX_LENGTHS.serviceType),
      message: normalize(body.message, MAX_LENGTHS.message),
      turnstileToken: typeof body.turnstileToken === "string" ? body.turnstileToken : ""
    };

    if (!data.name || !data.email || !data.url || !data.message || !EMAIL_PATTERN.test(data.email)) {
      return json(res, 400, { ok: false });
    }

    try {
      new URL(data.url);
    } catch (error) {
      return json(res, 400, { ok: false });
    }

    const remoteIp =
      req.headers["cf-connecting-ip"] ||
      req.headers["x-real-ip"] ||
      String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();

    const turnstileValid = await verifyTurnstile(data.turnstileToken, remoteIp);

    if (!turnstileValid) {
      return json(res, 403, { ok: false });
    }

    await sendEmail(data);
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { ok: false });
  }
};
