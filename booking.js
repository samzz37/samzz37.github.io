const bookingConfig = window.PORTFOLIO_CONFIG || {};
const bookingForm = document.querySelector("#booking-form");
const amountInput = document.querySelector("#advance-amount");
const amountSummary = document.querySelector("#amount-summary");
const paymentStatus = document.querySelector("#payment-status");
const payButton = document.querySelector("#pay-button");
const projectType = document.querySelector("#project-type");
const upiPanel = document.querySelector("#upi-panel");
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const queryPackage = new URLSearchParams(window.location.search).get("package");
if (["starter", "business", "custom"].includes(queryPackage)) projectType.value = queryPackage;

function updateAmount() {
  const value = Number(amountInput.value);
  amountSummary.textContent = Number.isFinite(value) && value >= 0 ? currency.format(value) : "₹—";
}

function setStatus(message, state = "pending") {
  paymentStatus.textContent = message;
  paymentStatus.dataset.state = state;
}

function makeUpiUrl(amount, projectId) {
  const url = new URL("upi://pay");
  url.searchParams.set("pa", bookingConfig.upiId || "");
  url.searchParams.set("pn", bookingConfig.displayName || "Sam Jebaraj S");
  url.searchParams.set("am", Number(amount).toFixed(2));
  url.searchParams.set("cu", "INR");
  url.searchParams.set("tn", `Project advance ${projectId.slice(0, 8)}`);
  return url.toString();
}

amountInput.addEventListener("input", updateAmount);
updateAmount();

const whatsappDigits = (bookingConfig.whatsappNumber || "").replace(/\D/g, "");
const whatsappLink = document.querySelector("[data-booking-whatsapp]");
if (whatsappDigits && whatsappLink) {
  whatsappLink.href = `https://wa.me/${whatsappDigits}`;
  whatsappLink.hidden = false;
}

const menuToggle = document.querySelector(".menu-toggle");
const bookingNav = document.querySelector("#booking-nav");
menuToggle?.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!open));
  menuToggle.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
  bookingNav?.classList.toggle("is-open", !open);
});
bookingNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Open navigation");
  bookingNav.classList.remove("is-open");
}));

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!bookingForm.reportValidity()) return;

  const amount = Number(amountInput.value);
  if (!Number.isInteger(amount) || amount < 300 || amount > 500000) {
    setStatus("Enter a whole-rupee advance from ₹300 to ₹5,00,000.", "error");
    amountInput.focus();
    return;
  }
  if (!bookingConfig.upiId) {
    setStatus("Sam’s UPI payment details are not configured yet. Please use WhatsApp.", "error");
    return;
  }

  const payload = {
    customerName: document.querySelector("#customer-name").value.trim(),
    customerEmail: document.querySelector("#customer-email").value.trim(),
    customerPhone: document.querySelector("#customer-phone").value.trim(),
    projectType: projectType.value,
    projectBrief: document.querySelector("#project-brief").value.trim(),
    projectBudget: document.querySelector("#project-budget").value.trim(),
    advanceAmountRupees: amount
  };

  payButton.disabled = true;
  payButton.querySelector(".pay-button-label").textContent = "Creating your private project page…";
  setStatus("Saving your request securely and preparing your UPI transfer.");

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not create the project request. Please try again.");

    document.querySelector("#upi-id").textContent = bookingConfig.upiId;
    document.querySelector("#upi-amount").textContent = currency.format(result.advanceAmountRupees);
    document.querySelector("#upi-launch").href = makeUpiUrl(result.advanceAmountRupees, result.projectId);
    document.querySelector("#portal-link").href = result.portalUrl;
    document.querySelector("#portal-link").textContent = "Open your private project page ↗";
    document.querySelector("#copy-upi").addEventListener("click", async (copyEvent) => {
      const button = copyEvent.currentTarget;
      try {
        await navigator.clipboard.writeText(bookingConfig.upiId);
        button.textContent = "Copied";
      } catch {
        button.textContent = "Copy unavailable";
      }
    }, { once: true });
    upiPanel.hidden = false;
    bookingForm.querySelectorAll("input, select, textarea").forEach((field) => { field.disabled = true; });
    payButton.querySelector(".pay-button-label").textContent = "Booking request created";
    setStatus("Transfer the amount shown, then use your private project page to submit the UPI reference (UTR). Sam will verify it manually before unlocking the preview.", "success");
    upiPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    setStatus(error.message || "Could not create the booking. Please contact Sam.", "error");
    payButton.disabled = false;
    payButton.querySelector(".pay-button-label").textContent = "Create booking and show UPI payment";
  }
});
