const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const year = document.querySelector("[data-year]");
const contactForm = document.querySelector("#contact-form");
const formStatus = document.querySelector("#form-status");
const privacyError = document.querySelector("#privacy-error");

let turnstileToken = "";
let miniAuditFormStarted = false;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

window.dataLayer = window.dataLayer || [];

function pushAnalyticsEvent(eventName, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...params
  });
}

const getCtaLocation = (element) => {
  if (element.closest(".site-header")) return "header";
  if (element.closest(".hero")) return "hero";
  if (element.closest(".packages")) return "packages";
  if (element.closest(".contact")) return "contact";
  if (element.closest(".site-footer")) return "footer";
  return "other";
};

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

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const cta = target.closest("[data-analytics='cta-mini-audit']");
  if (!(cta instanceof HTMLElement)) return;

  pushAnalyticsEvent("click_cta_mini_audit", {
    cta_location: cta.dataset.ctaLocation || getCtaLocation(cta),
    cta_text: cta.textContent.trim()
  });
});

const setFormStatus = (message, type) => {
  if (!formStatus) return;

  formStatus.textContent = message;
  formStatus.classList.remove("is-success", "is-error", "form-status--success", "form-status--error");

  if (type) {
    formStatus.classList.add(`is-${type}`);
    formStatus.classList.add(`form-status--${type}`);
  }
};

const focusFirstInvalidField = (field) => {
  if (!(field instanceof HTMLElement)) return;

  const headerOffset = 120;
  const y = field.getBoundingClientRect().top + window.pageYOffset - headerOffset;
  window.scrollTo({ top: y, behavior: "smooth" });
  setTimeout(() => field.focus({ preventScroll: true }), 300);
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
  privacyError.hidden = !message;

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

const getFieldErrorElement = (field) => {
  if (!field.id) return null;
  return document.getElementById(`${field.id}-error`);
};

const setFieldError = (field, message) => {
  const error = getFieldErrorElement(field);
  if (!error) return;

  error.textContent = message;
  error.hidden = !message;

  if (message) {
    field.classList.add("input-error");
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", error.id);
  } else {
    field.classList.remove("input-error");
    field.setAttribute("aria-invalid", "false");
    field.removeAttribute("aria-describedby");
  }
};

const getFormControl = (form, name) => {
  const control = form.elements[name];
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    return control;
  }
  return null;
};

const validateRequiredFields = (form) => {
  const fieldRules = [
    { name: "name", emptyMessage: "Uzupełnij imię i nazwisko." },
    {
      name: "email",
      emptyMessage: "Podaj adres e-mail.",
      validate: (field) => emailPattern.test(field.value.trim()),
      invalidMessage: "Podaj poprawny adres e-mail."
    },
    { name: "url", emptyMessage: "Wklej link do strony, Instagrama, Booksy albo wizytówki Google." },
    { name: "city", emptyMessage: "Podaj miasto." },
    { name: "serviceType", emptyMessage: "Wpisz rodzaj usługi beauty." },
    { name: "message", emptyMessage: "Opisz krótko, co dziś najbardziej przeszkadza." }
  ];

  let firstInvalidField = null;

  fieldRules.forEach((rule) => {
    const field = getFormControl(form, rule.name);
    if (!field) return;

    const value = field.value.trim();
    let message = "";

    if (!value) {
      message = rule.emptyMessage;
    } else if (rule.validate && !rule.validate(field)) {
      message = rule.invalidMessage;
    }

    setFieldError(field, message);

    if (message && !firstInvalidField) {
      firstInvalidField = field;
    }
  });

  return firstInvalidField;
};

const resetTurnstile = () => {
  if (window.turnstile?.reset) {
    window.turnstile.reset();
  }
  turnstileToken = "";
};

window.onTurnstileSuccess = function (token) {
  turnstileToken = token || "";
  console.debug("Turnstile success:", Boolean(turnstileToken));
  clearFormStatus();
};

window.onTurnstileExpired = function () {
  turnstileToken = "";
};

window.onTurnstileError = function () {
  turnstileToken = "";
};

if (contactForm instanceof HTMLFormElement) {
  const privacyAcceptedInput = contactForm.elements.privacyAccepted;
  const requiredFieldNames = ["name", "email", "url", "city", "serviceType", "message"];

  const clearFormValidation = () => {
    requiredFieldNames.forEach((fieldName) => {
      const field = getFormControl(contactForm, fieldName);
      if (field) {
        setFieldError(field, "");
      }
    });

    if (privacyAcceptedInput instanceof HTMLInputElement) {
      setPrivacyError(privacyAcceptedInput, "");
    }
  };

  const trackFormStart = () => {
    if (miniAuditFormStarted) return;
    miniAuditFormStarted = true;
    pushAnalyticsEvent("form_start", {
      form_name: "mini_audit"
    });
  };

  contactForm.addEventListener("focusin", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      if (target.name !== "companyWebsite") {
        trackFormStart();
      }
    }
  });

  requiredFieldNames.forEach((fieldName) => {
    const field = getFormControl(contactForm, fieldName);
    if (!field) return;

    field.addEventListener("input", () => {
      if (fieldName === "email" && field.value.trim() && !emailPattern.test(field.value.trim())) {
        return;
      }

      if (field.value.trim()) {
        setFieldError(field, "");
      }
    });
  });

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

    const firstInvalidField = validateRequiredFields(contactForm);
    const privacyAccepted = contactForm.elements.privacyAccepted;
    const privacyInvalid = privacyAccepted instanceof HTMLInputElement && !privacyAccepted.checked;

    if (privacyInvalid) {
      setPrivacyError(privacyAccepted, "Potwierdź zapoznanie się z Polityką prywatności.");
    } else if (privacyAccepted instanceof HTMLInputElement) {
      setPrivacyError(privacyAccepted, "");
    }

    if (firstInvalidField || privacyInvalid) {
      setFormStatus("Uzupełnij wymagane pola i spróbuj ponownie.", "error");
      pushAnalyticsEvent("form_submit_error", {
        form_name: "mini_audit",
        error_type: "validation"
      });

      if (firstInvalidField) {
        focusFirstInvalidField(firstInvalidField);
      } else if (privacyAccepted instanceof HTMLInputElement) {
        focusFirstInvalidField(privacyAccepted);
      }
      return;
    }

    const formData = new FormData(contactForm);

    if (String(formData.get("companyWebsite") || "").trim()) {
      setFormStatus(
        "Dziękuję — prośba o mini-audyt została wysłana. Wrócę z odpowiedzią zazwyczaj w ciągu 1–2 dni roboczych.",
        "success"
      );
      contactForm.reset();
      clearFormValidation();
      resetTurnstile();
      return;
    }

    console.debug("Submit token available:", Boolean(turnstileToken));

    if (!turnstileToken) {
      setFormStatus("Potwierdź zabezpieczenie antyspamowe i spróbuj ponownie.", "error");
      pushAnalyticsEvent("form_submit_error", {
        form_name: "mini_audit",
        error_type: "turnstile"
      });
      const turnstileWrap = document.querySelector(".turnstile-wrap");
      if (turnstileWrap instanceof HTMLElement) {
        focusFirstInvalidField(turnstileWrap);
      }
      return;
    }

    const submitButton = contactForm.querySelector("button[type='submit']");
    const defaultButtonText = submitButton?.textContent || "Wyślij prośbę o mini-audyt";

    submitButton?.setAttribute("disabled", "true");
    if (submitButton) {
      submitButton.textContent = "Wysyłanie...";
    }
    setFormStatus("", "");

    let submitErrorType = "unknown";

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
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        submitErrorType = "backend";
        throw new Error("Contact endpoint unavailable");
      }

      contactForm.reset();
      clearFormValidation();
      resetTurnstile();
      setFormStatus(
        "Dziękuję — prośba o mini-audyt została wysłana. Wrócę z odpowiedzią zazwyczaj w ciągu 1–2 dni roboczych.",
        "success"
      );
      pushAnalyticsEvent("form_submit_success", {
        form_name: "mini_audit"
      });
    } catch (error) {
      resetTurnstile();
      setFormStatus("Nie udało się wysłać formularza. Spróbuj ponownie za chwilę.", "error");
      pushAnalyticsEvent("form_submit_error", {
        form_name: "mini_audit",
        error_type: typeof submitErrorType === "string" ? submitErrorType : "unknown"
      });
    } finally {
      submitButton?.removeAttribute("disabled");
      if (submitButton) {
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}
