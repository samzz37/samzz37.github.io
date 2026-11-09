const config = window.PORTFOLIO_CONFIG || {};
const token = new URLSearchParams(window.location.search).get("token") || "";
const message = document.querySelector("#portal-message");
const content = document.querySelector("#portal-content");
const transferCard = document.querySelector("#transfer-card");
const previewCard = document.querySelector("#preview-card");
const finalCard = document.querySelector("#final-card");
const utrForm = document.querySelector("#utr-form");
const reportButton = document.querySelector("#report-button");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
let currentProject = null;

function showMessage(text, state = "pending") {
  message.textContent = text;
  message.dataset.state = state;
}

function upiUrl(amount, suffix) {
  const url = new URL("upi://pay");
  url.searchParams.set("pa", config.upiId || "");
  url.searchParams.set("pn", config.displayName || "Sam Jebaraj S");
  url.searchParams.set("am", (amount / 100).toFixed(2));
  url.searchParams.set("cu", "INR");
  url.searchParams.set("tn", `Project ${currentProject.id.slice(0, 8)} ${suffix}`);
  return url.toString();
}

function createPaymentEvent(payment) {
  const row = document.createElement("article");
  row.className = "payment-event";
  const heading = document.createElement("strong");
  heading.textContent = payment.purpose === "advance" ? "Booking advance" : "Balance transfer";
  const status = document.createElement("span");
  status.className = `event-status status-${payment.status}`;
  status.textContent = payment.status.replaceAll("_", " ");
  const meta = document.createElement("span");
  meta.className = "event-meta";
  meta.textContent = payment.utr ? `UPI reference: ${payment.utr}` : "Transfer reference not submitted yet";
  const time = document.createElement("time");
  const date = new Date(payment.created_at);
  time.textContent = Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  row.append(heading, status, meta, time);
  return row;
}

function renderPortal(data) {
  currentProject = data.project;
  const project = data.project;
  const payments = data.payments || [];
  const pendingReview = payments.some((payment) => payment.status === "reported");
  const paid = Number(project.paidPaise || 0);
  const due = project.duePaise == null ? null : Number(project.duePaise);
  const initial = paid === 0;
  const availableAmount = initial ? Number(project.initialAdvancePaise) : due;

  document.querySelector("#project-reference").textContent = project.id.slice(0, 8).toUpperCase();
  document.querySelector("#project-greeting").textContent = `Hello, ${project.customerName}`;
  document.querySelector("#project-brief").textContent = project.projectBrief;
  document.querySelector("#project-kind").textContent = project.projectType.replaceAll("_", " ");
  const createdAt = new Date(project.createdAt);
  document.querySelector("#project-created").textContent = Number.isNaN(createdAt.valueOf()) ? "" : `REQUESTED ${createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  document.querySelector("#paid-amount").textContent = money.format(paid / 100);
  document.querySelector("#total-amount").textContent = project.totalPaise == null ? "Awaiting quote" : money.format(Number(project.totalPaise) / 100);
  document.querySelector("#due-amount").textContent = due == null ? "—" : money.format(due / 100);
  document.querySelector("#quote-caption").textContent = project.totalPaise == null ? "Sam will add the agreed price after reviewing the scope" : "Confirmed project price";
  document.querySelector("#due-caption").textContent = due === 0 ? "All agreed payments verified" : "Updates after Sam checks each transfer";
  document.querySelector("#portal-upi-id").textContent = config.upiId || "UPI payment details unavailable";

  const title = document.querySelector("#transfer-title");
  const instructions = document.querySelector("#transfer-instructions");
  const reportAmount = document.querySelector("#utr-amount");
  const launch = document.querySelector("#portal-upi-launch");
  const transferAmount = document.querySelector("#transfer-amount");
  const reportedNotice = document.querySelector("#reported-notice");
  const transferLabel = document.querySelector("#transfer-amount-label");
  const canRequestBalance = !initial && due != null && due > 0;
  transferCard.hidden = !initial && !canRequestBalance;
  if (!transferCard.hidden && availableAmount > 0) {
    title.textContent = initial ? "Booking advance" : "Remaining project balance";
    transferLabel.textContent = initial ? "Requested advance" : "Balance remaining";
    transferAmount.textContent = money.format(availableAmount / 100);
    instructions.textContent = initial
      ? "Send the requested advance to the UPI ID below. The preview unlocks only after Sam confirms the transfer."
      : "Send some or all of the remaining balance. Preview access stays available while Sam reviews your transfer; the final video unlocks after the full quoted amount is verified.";
    reportAmount.value = String(Math.floor(availableAmount / 100));
    reportAmount.max = String(Math.floor(availableAmount / 100));
    reportAmount.min = initial ? String(Math.floor(availableAmount / 100)) : "1";
    reportAmount.readOnly = initial;
    launch.href = config.upiId ? upiUrl(availableAmount, initial ? "advance" : "balance") : "#";
    launch.hidden = !config.upiId || pendingReview;
    document.querySelector("#utr-form").hidden = pendingReview;
    reportedNotice.hidden = !pendingReview;
    reportedNotice.textContent = pendingReview ? "Your UPI reference is awaiting Sam’s manual review. The balance changes only after verification." : "";
    reportButton.disabled = false;
  }

  const paymentHistory = document.querySelector("#payment-history");
  paymentHistory.replaceChildren();
  if (payments.length) payments.forEach((payment) => paymentHistory.append(createPaymentEvent(payment)));
  else {
    const empty = document.createElement("p");
    empty.className = "portal-small-print";
    empty.textContent = "No transfer has been reported yet.";
    paymentHistory.append(empty);
  }

  previewCard.hidden = !project.previewAvailable;
  if (project.previewAvailable) {
    const preview = new URL("/api/portal/video", window.location.origin);
    preview.searchParams.set("token", token);
    preview.searchParams.set("kind", "preview");
    const video = document.querySelector("#preview-video");
    if (video.src !== preview.toString()) video.src = preview.toString();
  }
  finalCard.hidden = !project.finalAvailable;
  if (project.finalAvailable) {
    const finalUrl = new URL("/api/portal/video", window.location.origin);
    finalUrl.searchParams.set("token", token);
    finalUrl.searchParams.set("kind", "final");
    const video = document.querySelector("#final-video");
    if (video.src !== finalUrl.toString()) video.src = finalUrl.toString();
    const download = new URL(finalUrl);
    download.searchParams.set("download", "1");
    document.querySelector("#download-final").href = download.toString();
  }

  if (initial && pendingReview) showMessage("Your advance reference is with Sam for manual verification. The project preview stays locked until it is confirmed.");
  else if (initial) showMessage("Your private project page is ready. Send the advance and submit its UPI reference here.");
  else if (due === 0 && project.finalAvailable) showMessage("Your full payment is verified. The final project video is unlocked.", "success");
  else if (due === 0) showMessage("Your full payment is verified. Sam is adding the final delivery video.", "success");
  else if (pendingReview) showMessage("Your UPI transfer is awaiting manual review. The verified balance will update here.");
  else if (project.totalPaise == null) showMessage("Your advance is verified. Sam will add the agreed project quote and progress video.", "success");
  else if (project.previewAvailable) showMessage("Your advance is verified. The preview is available and the remaining balance is shown below.", "success");
  else showMessage("Your advance is verified. Sam will add the preview video; the remaining balance is shown below.", "success");

  content.hidden = false;
}

async function loadPortal(initial = false) {
  if (!token) {
    showMessage("This private project link is incomplete. Open the full link Sam shared with you.", "error");
    return;
  }
  try {
    const url = new URL("/api/portal", window.location.origin);
    url.searchParams.set("token", token);
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load the project page.");
    renderPortal(data);
  } catch (error) {
    if (initial) showMessage(error.message || "Could not load this project. Contact Sam for help.", "error");
  }
}

utrForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!utrForm.reportValidity() || !currentProject) return;
  reportButton.disabled = true;
  reportButton.querySelector("span").textContent = "Submitting reference…";
  try {
    const response = await fetch("/api/portal/report-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        token,
        amountRupees: Number(document.querySelector("#utr-amount").value),
        utr: document.querySelector("#utr-reference").value.trim()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not submit the reference.");
    document.querySelector("#utr-reference").value = "";
    await loadPortal();
  } catch (error) {
    showMessage(error.message || "Could not submit the UPI reference.", "error");
  } finally {
    reportButton.disabled = false;
    reportButton.querySelector("span").textContent = "Submit transfer reference for review";
  }
});

document.querySelector("#portal-copy-upi").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(config.upiId || "");
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy unavailable";
  }
});
document.querySelector("#utr-amount").addEventListener("input", (event) => {
  if (!currentProject || Number(currentProject.paidPaise) === 0) return;
  const amount = Number(event.currentTarget.value);
  const due = Number(currentProject.duePaise || 0);
  if (Number.isInteger(amount) && amount > 0 && amount * 100 <= due) {
    document.querySelector("#transfer-amount").textContent = money.format(amount);
    document.querySelector("#portal-upi-launch").href = upiUrl(amount * 100, "balance");
  }
});
document.querySelector("#refresh-portal").addEventListener("click", () => loadPortal());

const whatsappDigits = (config.whatsappNumber || "").replace(/\D/g, "");
if (whatsappDigits) document.querySelector("[data-portal-whatsapp]").href = `https://wa.me/${whatsappDigits}`;

loadPortal(true);
window.setInterval(() => loadPortal(), 25000);
