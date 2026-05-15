const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const year = document.querySelector("[data-year]");
const contactForm = document.querySelector("#contact-form");
const formStatus = document.querySelector("#form-status");
const privacyError = document.querySelector("#privacy-error");

let turnstileToken = "";
let miniAuditFormStarted = false;

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

document.querySelectorAll("a[href='#kontakt'], a[href='index.html#kontakt']").forEach((link) => {
  link.addEventListener("click", () => {
    pushAnalyticsEvent("click_cta_mini_audit", {
      cta_location: getCtaLocation(link),
      cta_text: link.textContent.trim()
    });
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
      pushAnalyticsEvent("form_submit_error", {
        form_name: "mini_audit",
        error_type: "validation"
      });
      return;
    }

    if (privacyAccepted instanceof HTMLInputElement) {
      setPrivacyError(privacyAccepted, "");
    }

    if (!contactForm.reportValidity()) {
      pushAnalyticsEvent("form_submit_error", {
        form_name: "mini_audit",
        error_type: "validation"
      });
      return;
    }

    const formData = new FormData(contactForm);

    if (String(formData.get("companyWebsite") || "").trim()) {
      setFormStatus(
        "Dziękuję — prośba o mini-audyt została wysłana. Wrócę z odpowiedzią zazwyczaj w ciągu 1–2 dni roboczych.",
        "success"
      );
      contactForm.reset();
      if (privacyAccepted instanceof HTMLInputElement) {
        setPrivacyError(privacyAccepted, "");
      }
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
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        throw new Error("Contact endpoint unavailable");
      }

      contactForm.reset();
      if (privacyAccepted instanceof HTMLInputElement) {
        setPrivacyError(privacyAccepted, "");
      }
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
        error_type: error instanceof Error ? "backend" : "unknown"
      });
    } finally {
      submitButton?.removeAttribute("disabled");
      if (submitButton) {
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}
