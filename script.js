const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const year = document.querySelector("[data-year]");
const contactForm = document.querySelector("#contact-form");
const formStatus = document.querySelector("#form-status");
const privacyError = document.querySelector("#privacy-error");

let turnstileToken = "";

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
  formStatus.classList.remove("is-success", "is-error", "form-status--success", "form-status--error");

  if (type) {
    formStatus.classList.add(`is-${type}`);
    formStatus.classList.add(`form-status--${type}`);
  }
};

function clearFormStatus() {
  const status = document.getElementById("form-status");
  if (!status) return;

  status.textContent = "";
  status.className = "form-status";
}

const setPrivacyError = (checkbox, message) => {
  if (!privacyError) return;

  const consent = checkbox?.closest?.(".form-consent");
  privacyError.textContent = message;

  if (message) {
    checkbox?.setAttribute("aria-invalid", "true");
    checkbox?.setAttribute("aria-describedby", "privacy-error");
    consent?.classList.add("has-error");
  } else {
    checkbox?.setAttribute("aria-invalid", "false");
    checkbox?.removeAttribute("aria-describedby");
    consent?.classList.remove("has-error");
  }
};

const resetTurnstile = () => {
  if (window.turnstile?.reset) {
    window.turnstile.reset();
  }
  turnstileToken = "";
};

window.onTurnstileSuccess = function (token) {
  turnstileToken = token || "";
  console.log("Turnstile token received:", Boolean(turnstileToken));
  clearFormStatus();
};

window.onTurnstileExpired = function () {
  turnstileToken = "";
};

window.onTurnstileError = function () {
  turnstileToken = "";
  setFormStatus("Nie udało się potwierdzić zabezpieczenia antyspamowego. Odśwież stronę lub spróbuj ponownie za chwilę.", "error");
};

if (contactForm instanceof HTMLFormElement) {
  const privacyAcceptedInput = contactForm.elements.privacyAccepted;

  if (privacyAcceptedInput instanceof HTMLInputElement) {
    privacyAcceptedInput.addEventListener("change", () => {
      if (privacyAcceptedInput.checked) {
        setPrivacyError(privacyAcceptedInput, "");
      }
    });
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormStatus("", "");

    const privacyAccepted = contactForm.elements.privacyAccepted;

    if (privacyAccepted instanceof HTMLInputElement && !privacyAccepted.checked) {
      setPrivacyError(privacyAccepted, "Zaznacz zgodę, aby wysłać formularz.");
      privacyAccepted.focus();
      return;
    }

    if (privacyAccepted instanceof HTMLInputElement) {
      setPrivacyError(privacyAccepted, "");
    }

    if (!contactForm.reportValidity()) {
      return;
    }

    const formData = new FormData(contactForm);

    if (String(formData.get("companyWebsite") || "").trim()) {
      setFormStatus("Dziękuję — formularz został wysłany. Odpowiem mailowo tak szybko, jak to możliwe.", "success");
      contactForm.reset();
      if (privacyAccepted instanceof HTMLInputElement) {
        setPrivacyError(privacyAccepted, "");
      }
      resetTurnstile();
      return;
    }

    if (!turnstileToken) {
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
        privacyAccepted: privacyAccepted instanceof HTMLInputElement && privacyAccepted.checked,
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
      if (privacyAccepted instanceof HTMLInputElement) {
        setPrivacyError(privacyAccepted, "");
      }
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
