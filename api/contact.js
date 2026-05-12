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

const textValue = (value) => value || "Nie podano";

const renderInfoRow = (label, value) => `
  <tr>
    <td style="padding:0 0 6px;color:#7a5b4c;font-size:12px;line-height:1.4;text-transform:uppercase;letter-spacing:.06em;font-weight:700;">${escapeHtml(label)}</td>
  </tr>
  <tr>
    <td style="padding:0 0 18px;color:#2f211a;font-size:15px;line-height:1.55;">${escapeHtml(value).replaceAll("\n", "<br>")}</td>
  </tr>`;

const renderSection = (title, rows) => `
  <tr>
    <td style="padding:22px 0 8px;border-top:1px solid #eaded0;color:#8f5646;font-size:13px;line-height:1.4;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">${escapeHtml(title)}</td>
  </tr>
  ${rows.map(([label, value]) => renderInfoRow(label, value)).join("")}`;

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

  const adminSections = [
    {
      title: "Dane kontaktowe",
      rows: [
        ["Imię i nazwisko", name],
        ["Email", email]
      ]
    },
    {
      title: "Link / obecność online",
      rows: [["Link", url]]
    },
    {
      title: "Kontekst",
      rows: [
        ["Miasto", textValue(city)],
        ["Rodzaj usługi beauty", textValue(serviceType)],
        ["Data wysłania", sentAt],
        [
          "Polityka prywatności",
          privacyAccepted
            ? "Użytkownik potwierdził zapoznanie się z Polityką prywatności: tak"
            : "Brak potwierdzenia."
        ],
        ["Źródło", "Formularz mini-audytu ClarioBase"]
      ]
    },
    {
      title: "Treść zgłoszenia",
      rows: [["Co dziś przeszkadza", message]]
    }
  ];

  const adminText = [
    "Nowa prośba o mini-audyt",
    "",
    "Dane kontaktowe",
    `Imię i nazwisko: ${name}`,
    `Email: ${email}`,
    "",
    "Link / obecność online",
    `Link: ${url}`,
    "",
    "Kontekst",
    `Miasto: ${textValue(city)}`,
    `Rodzaj usługi beauty: ${textValue(serviceType)}`,
    `Data wysłania: ${sentAt}`,
    `Polityka prywatności: ${
      privacyAccepted ? "Użytkownik potwierdził zapoznanie się z Polityką prywatności: tak" : "Brak potwierdzenia."
    }`,
    "Źródło: Formularz mini-audytu ClarioBase",
    "",
    "Treść zgłoszenia",
    `Co dziś przeszkadza: ${message}`
  ].join("\n");

  const adminHtml = `
    <div style="margin:0;padding:28px;background:#fbf7f0;font-family:Arial,sans-serif;color:#2f211a;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:680px;border-collapse:collapse;background:#fffaf3;border:1px solid #eaded0;border-radius:22px;">
              <tr>
                <td style="padding:30px 30px 10px;">
                  <div style="color:#8f5646;font-size:13px;line-height:1.4;text-transform:uppercase;letter-spacing:.12em;font-weight:800;">ClarioBase</div>
                  <h1 style="margin:10px 0 10px;color:#2f211a;font-size:24px;line-height:1.18;">Nowa prośba o mini-audyt</h1>
                  <p style="margin:0;color:#6f5649;font-size:15px;line-height:1.65;">Wiadomość przyszła z formularza ClarioBase. Odpowiedź na tego maila powinna trafić do osoby z formularza.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 30px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                    ${adminSections.map((section) => renderSection(section.title, section.rows)).join("")}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>`;

  await sendResendEmail({
    from: fromEmail,
    to: [toEmail],
    reply_to: email,
    subject: "Nowa prośba o mini-audyt",
    text: adminText,
    html: adminHtml
  });

  try {
    const autoresponderText = [
      "ClarioBase",
      "Mini-audyt strony dla branży beauty",
      "",
      "Prośba o mini-audyt dotarła.",
      "",
      "Dzień dobry,",
      "",
      "dziękuję za przesłanie formularza. Sprawdzę podany link i wrócę z krótką odpowiedzią zawierającą 2-3 konkretne obserwacje.",
      "",
      "Co dalej?",
      "1. Sprawdzę stronę, Instagram, Booksy albo wizytówkę Google.",
      "2. Zwrócę uwagę na jasność oferty, wiarygodność i ścieżkę do umówienia wizyty.",
      "3. Odeślę pierwszy sensowny krok, od którego warto zacząć.",
      "",
      "Zazwyczaj odpowiadam w ciągu 1-2 dni roboczych.",
      "",
      "Pozdrawiam",
      "Łukasz Chmiel",
      "ClarioBase",
      "",
      "Ta wiadomość została wysłana automatycznie po przesłaniu formularza mini-audytu na stronie ClarioBase."
    ].join("\n");

    const autoresponderHtml = `
      <div style="margin:0;padding:28px;background:#fbf7f0;font-family:Arial,sans-serif;color:#2f211a;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:600px;border-collapse:collapse;background:#fffaf3;border:1px solid #eaded0;border-radius:22px;">
                <tr>
                  <td style="padding:34px 30px 10px;">
                    <div style="color:#2f211a;font-size:18px;line-height:1.2;font-weight:800;">ClarioBase</div>
                    <div style="margin-top:8px;color:#8f5646;font-size:12px;line-height:1.4;text-transform:uppercase;letter-spacing:.12em;font-weight:800;">Mini-audyt strony dla branży beauty</div>
                    <h1 style="margin:24px 0 16px;color:#2f211a;font-size:26px;line-height:1.16;">Prośba o mini-audyt dotarła.</h1>
                    <p style="margin:0 0 14px;color:#4c372c;font-size:16px;line-height:1.7;">Dzień dobry,</p>
                    <p style="margin:0 0 20px;color:#4c372c;font-size:16px;line-height:1.7;">dziękuję za przesłanie formularza. Sprawdzę podany link i wrócę z krótką odpowiedzią zawierającą 2-3 konkretne obserwacje.</p>
                    <h2 style="margin:24px 0 12px;color:#2f211a;font-size:18px;line-height:1.3;">Co dalej?</h2>
                    <ol style="margin:0 0 22px;padding-left:20px;color:#4c372c;font-size:15px;line-height:1.75;">
                      <li>Sprawdzę stronę, Instagram, Booksy albo wizytówkę Google.</li>
                      <li>Zwrócę uwagę na jasność oferty, wiarygodność i ścieżkę do umówienia wizyty.</li>
                      <li>Odeślę pierwszy sensowny krok, od którego warto zacząć.</li>
                    </ol>
                    <p style="margin:0 0 24px;padding:14px 16px;border-radius:16px;background:#f3eadf;color:#4c372c;font-size:15px;line-height:1.6;">Zazwyczaj odpowiadam w ciągu 1-2 dni roboczych.</p>
                    <p style="margin:0;color:#4c372c;font-size:16px;line-height:1.7;">Pozdrawiam<br><strong>Łukasz Chmiel</strong><br>ClarioBase</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 30px 30px;">
                    <p style="margin:0;padding-top:18px;border-top:1px solid #eaded0;color:#80665a;font-size:12px;line-height:1.6;">Ta wiadomość została wysłana automatycznie po przesłaniu formularza mini-audytu na stronie ClarioBase.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`;

    await sendResendEmail(
      {
        from: fromEmail,
        to: [email],
        reply_to: replyEmail,
        subject: "Dziękuję za prośbę o mini-audyt",
        text: autoresponderText,
        html: autoresponderHtml
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
