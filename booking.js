const bookingConfig = window.PORTFOLIO_CONFIG || {};
const bookingForm = document.querySelector("#booking-form");
const amountInput = document.querySelector("#advance-amount");
const amountSummary = document.querySelector("#amount-summary");
const paymentStatus = document.querySelector("#payment-status");
const payButton = document.querySelector("#pay-button");
const projectType = document.querySelector("#project-type");
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

async function loadRazorpayCheckout() {
  if (window.Razorpay) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded. Please try again."));
    document.head.append(script);
  });
}

async function readJson(response) {
  try { return await response.json(); }
  catch { return {}; }
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!bookingForm.reportValidity()) return;

  const amount = Number(amountInput.value);
  if (!Number.isInteger(amount) || amount < 300 || amount > 500000) {
    setStatus("Enter a whole-rupee advance from ₹300 to ₹5,00,000.", "error");
    amountInput.focus();
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
  payButton.querySelector(".pay-button-label").textContent = "Preparing secure checkout…";
  setStatus("Creating your Razorpay order. Your card or UPI details stay in Razorpay Checkout.");

  try {
    const orderResponse = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const order = await readJson(orderResponse);
    if (!orderResponse.ok) throw new Error(order.error || "Could not start checkout. Please try again.");

    await loadRazorpayCheckout();
    let paymentHandlerStarted = false;
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: bookingConfig.displayName || "Sam Jebaraj S",
      description: `Project booking advance - ${projectType.options[projectType.selectedIndex].text}`,
      prefill: {
        name: payload.customerName,
        email: payload.customerEmail,
        contact: payload.customerPhone
      },
      notes: { project_type: projectType.value },
      theme: { color: "#A6B1E1" },
      modal: {
        ondismiss: () => {
          if (!paymentHandlerStarted) {
            setStatus("Checkout closed. No booking advance has been confirmed.", "pending");
            payButton.disabled = false;
            payButton.querySelector(".pay-button-label").textContent = "Continue to secure payment";
          }
        }
      },
      handler: async (paymentResult) => {
        paymentHandlerStarted = true;
        setStatus("Payment received by checkout. Verifying it securely…");
        try {
          const verifyResponse = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              razorpay_order_id: paymentResult.razorpay_order_id,
              razorpay_payment_id: paymentResult.razorpay_payment_id,
              razorpay_signature: paymentResult.razorpay_signature
            })
          });
          const verification = await readJson(verifyResponse);
          if (verification.captured) {
            setStatus(`Advance payment verified. Booking reference: ${verification.orderId}. Your project details are attached to the Razorpay order for Sam.`, "success");
            bookingForm.reset();
            amountInput.value = "300";
            updateAmount();
          } else if (verification.verified) {
            setStatus(`Payment is authorized but still awaiting capture. Booking reference: ${verification.orderId}. Please contact Sam to confirm the payment status.`, "pending");
          } else {
            throw new Error(verification.error || `Payment verification could not be completed. Share this reference with Sam: ${paymentResult.razorpay_order_id}`);
          }
        } catch (error) {
          setStatus(error.message || "Payment verification could not be completed. Please contact Sam with your order reference.", "error");
        } finally {
          payButton.disabled = false;
          payButton.querySelector(".pay-button-label").textContent = "Continue to secure payment";
        }
      }
    });

    checkout.on("payment.failed", (failure) => {
      const reference = failure.error?.metadata?.order_id;
      setStatus(reference ? `The payment was not completed. You can retry or share this reference with Sam: ${reference}` : "The payment was not completed. You can retry checkout or contact Sam.", "error");
      payButton.disabled = false;
      payButton.querySelector(".pay-button-label").textContent = "Continue to secure payment";
    });
    checkout.open();
  } catch (error) {
    setStatus(error.message || "Could not start checkout. Please contact Sam.", "error");
    payButton.disabled = false;
    payButton.querySelector(".pay-button-label").textContent = "Continue to secure payment";
  }
});
