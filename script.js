const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const year = document.querySelector("[data-year]");
const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const setFormStatus = (message, type) => {
  if (!formStatus) return;

  formStatus.textContent = message;
  formStatus.classList.remove("is-success", "is-error");

  if (type) {
    formStatus.classList.add(`is-${type}`);
  }
};

const getRecaptchaToken = async (form) => {
  const action = form.dataset.recaptchaAction || "mini_audit_submit";
  const siteKey = form.dataset.recaptchaSiteKey;

  if (!siteKey || !window.grecaptcha?.execute) {
    return "";
  }

  return window.grecaptcha.execute(siteKey, { action });
};

if (contactForm instanceof HTMLFormElement) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormStatus("", "");

    if (!contactForm.reportValidity()) {
      setFormStatus("Uzupełnij wymagane pola i sprawdź poprawność adresu email oraz linku.", "error");
      return;
    }

    const formData = new FormData(contactForm);

    if (String(formData.get("company_website") || "").trim()) {
      setFormStatus("Nie udało się wysłać formularza. Spróbuj ponownie później.", "error");
      return;
    }

    const submitButton = contactForm.querySelector("button[type='submit']");
    submitButton?.setAttribute("disabled", "true");
    setFormStatus("Wysyłam formularz...", "");

    try {
      const recaptchaToken = await getRecaptchaToken(contactForm);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        link: String(formData.get("link") || "").trim(),
        city: String(formData.get("city") || "").trim(),
        serviceType: String(formData.get("service_type") || "").trim(),
        message: String(formData.get("message") || "").trim(),
        recaptchaAction: contactForm.dataset.recaptchaAction || "mini_audit_submit",
        recaptchaToken
      };

      // TODO: endpoint serverless must verify reCAPTCHA token server-side before sending email.
      const response = await fetch(contactForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Contact endpoint unavailable");
      }

      contactForm.reset();
      setFormStatus("Dziękuję. Formularz został wysłany.", "success");
    } catch (error) {
      setFormStatus("Nie udało się wysłać formularza. Spróbuj ponownie później.", "error");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });
}
