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

const sendResendEmail = async (payload, options = {}) => {
  const { logErrorBody = true } = options;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resendResponse.ok) {
    const resendErrorBody = await resendResponse.text();

    if (logErrorBody) {
      console.error("Resend send failed", {
        status: resendResponse.status,
        body: resendErrorBody
      });
    }

    const error = new Error("Email delivery failed");
    error.code = "EMAIL_DELIVERY_FAILED";
    error.status = resendResponse.status;
    throw error;
  }
};

const sendEmail = async ({ name, email, url, city, serviceType, message, privacyAccepted }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing email configuration");
  }

  const toEmail = process.env.CONTACT_TO_EMAIL || "kontakt@clariobase.pl";
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "ClarioBase <kontakt@clariobase.pl>";
  const replyEmail = "kontakt@clariobase.pl";

  const sentAt = new Date().toLocaleString("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw"
  });

  const rows = [
    ["Imię i nazwisko", name],
    ["Email", email],
    ["Link do strony / Instagrama / Booksy / wizytówki Google", url],
    ["Miasto", city || "Nie podano"],
    ["Rodzaj usługi beauty", serviceType || "Nie podano"],
    ["Opis problemu", message],
    [
      "Polityka prywatności",
      privacyAccepted
        ? "Użytkownik potwierdził zapoznanie się z Polityką prywatności: tak"
        : "Brak potwierdzenia."
    ],
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

  await sendResendEmail({
    from: fromEmail,
    to: [toEmail],
    reply_to: email,
    subject: "Nowa prośba o mini-audyt — ClarioBase",
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#3a2923;">
        <h1 style="font-size:22px;margin:0 0 16px;">Nowa prośba o mini-audyt — ClarioBase</h1>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px;background:#fffaf2;border:1px solid #eaded0;">
          ${htmlRows}
        </table>
      </div>`
  });

  try {
    const autoresponderText = [
      "Dzień dobry,",
      "",
      "dziękuję za wysłanie prośby o mini-audyt.",
      "",
      "Wrócę z krótką odpowiedzią i 2–3 konkretnymi obserwacjami zazwyczaj w ciągu 1–2 dni roboczych.",
      "",
      "Pozdrawiam",
      "Łukasz Chmiel",
      "ClarioBase"
    ].join("\n");

    await sendResendEmail(
      {
        from: fromEmail,
        to: [email],
        reply_to: replyEmail,
        subject: "Dziękuję za prośbę o mini-audyt — ClarioBase",
        text: autoresponderText,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#3a2923;">
            <p>Dzień dobry,</p>
            <p>dziękuję za wysłanie prośby o mini-audyt.</p>
            <p>Wrócę z krótką odpowiedzią i 2–3 konkretnymi obserwacjami zazwyczaj w ciągu 1–2 dni roboczych.</p>
            <p>Pozdrawiam<br>Łukasz Chmiel<br>ClarioBase</p>
          </div>`
      },
      { logErrorBody: false }
    );
  } catch (error) {
    console.warn("Resend autoresponder failed", {
      code: error.code || "UNKNOWN_AUTORESPONDER_ERROR",
      status: error.status || null
    });
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
      privacyAccepted: body.privacyAccepted === true,
      turnstileToken: typeof body.turnstileToken === "string" ? body.turnstileToken : ""
    };

    if (!data.privacyAccepted) {
      return json(res, 400, { ok: false });
    }

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
    if (error.code === "EMAIL_DELIVERY_FAILED") {
      return json(res, 500, { ok: false, message: "Email delivery failed" });
    }

    return json(res, 500, { ok: false });
  }
};
