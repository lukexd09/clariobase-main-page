const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const year = document.querySelector("[data-year]");
const contactForm = document.querySelector("#contact-form");
const formStatus = document.querySelector("#form-status");

let turnstileReady = false;

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

const resetTurnstile = () => {
  if (window.turnstile?.reset) {
    window.turnstile.reset();
  }
  turnstileReady = false;
};

window.onTurnstileSuccess = () => {
  turnstileReady = true;
  if (formStatus?.classList.contains("is-error")) {
    setFormStatus("", "");
  }
};

window.onTurnstileExpired = () => {
  turnstileReady = false;
};

window.onTurnstileError = () => {
  turnstileReady = false;
  setFormStatus("Potwierdź zabezpieczenie antyspamowe i spróbuj ponownie.", "error");
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

    if (String(formData.get("companyWebsite") || "").trim()) {
      setFormStatus("Dziękuję — formularz został wysłany. Odpowiem mailowo tak szybko, jak to możliwe.", "success");
      contactForm.reset();
      resetTurnstile();
      return;
    }

    const turnstileToken = window.turnstile?.getResponse ? window.turnstile.getResponse() : "";

    if (!turnstileToken || !turnstileReady) {
      setFormStatus("Potwierdź zabezpieczenie antyspamowe i spróbuj ponownie.", "error");
      return;
    }

    const submitButton = contactForm.querySelector("button[type='submit']");
    const defaultButtonText = submitButton?.textContent || "Wyślij prośbę o mini-audyt";

    submitButton?.setAttribute("disabled", "true");
    if (submitButton) {
      submitButton.textContent = "Wysyłanie...";
    }
    setFormStatus("", "");

    try {
      const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        url: String(formData.get("url") || "").trim(),
        city: String(formData.get("city") || "").trim(),
        serviceType: String(formData.get("serviceType") || "").trim(),
        message: String(formData.get("message") || "").trim(),
        companyWebsite: String(formData.get("companyWebsite") || "").trim(),
        turnstileToken
      };

      const response = await fetch(contactForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Contact endpoint unavailable");
      }

      contactForm.reset();
      resetTurnstile();
      setFormStatus("Dziękuję — formularz został wysłany. Odpowiem mailowo tak szybko, jak to możliwe.", "success");
    } catch (error) {
      resetTurnstile();
      setFormStatus("Nie udało się wysłać formularza. Spróbuj ponownie za chwilę.", "error");
    } finally {
      submitButton?.removeAttribute("disabled");
      if (submitButton) {
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}
