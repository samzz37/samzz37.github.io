const authForm = document.querySelector("#admin-login-form");
const loginMessage = document.querySelector("#admin-login-message");
const adminMessage = document.querySelector("#admin-message");
const dashboard = document.querySelector("#admin-dashboard");
const authPanel = document.querySelector("#admin-auth");
const projectList = document.querySelector("#admin-project-list");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
let adminKey = "";

function setNotice(element, message, state = "pending") {
  element.textContent = message;
  element.dataset.state = state;
}

async function api(action = "GET", payload = null) {
  const response = await fetch("/api/admin", {
    method: action,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    credentials: "same-origin",
    cache: "no-store",
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The admin request could not be completed.");
  return data;
}

function makeButton(text, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", action);
  return button;
}

function renderPayment(payment, projectId) {
  const item = document.createElement("article");
  item.className = "admin-payment";
  const summary = document.createElement("div");
  const amount = document.createElement("strong");
  amount.textContent = `${payment.purpose === "advance" ? "Advance" : "Balance transfer"} · ${money.format(Number(payment.amount_paise) / 100)}`;
  const meta = document.createElement("div");
  meta.className = "payment-meta";
  const date = new Date(payment.created_at);
  const dateText = Number.isNaN(date.valueOf()) ? "" : date.toLocaleString("en-IN");
  meta.textContent = `UPI reference: ${payment.utr || "not submitted"} · ${payment.status.replaceAll("_", " ")} · ${dateText}`;
  summary.append(amount, meta);
  item.append(summary);
  const actions = document.createElement("div");
  actions.className = "admin-payment-actions";
  if (payment.status === "reported") {
    actions.append(
      makeButton("Verify after bank check", "verify-transfer", async () => {
        if (!window.confirm("Check that the UPI transfer is visible in your bank account before verifying it.")) return;
        try {
          await api("POST", { action: "verify-payment", paymentId: payment.id, projectId });
          setNotice(adminMessage, "Transfer verified. The customer portal will refresh automatically.", "success");
          await loadProjects();
        } catch (error) { setNotice(adminMessage, error.message, "error"); }
      }),
      makeButton("Reject", "reject-transfer", async () => {
        if (!window.confirm("Reject this reported transfer? The customer can submit a corrected reference.")) return;
        try {
          await api("POST", { action: "reject-payment", paymentId: payment.id, projectId });
          setNotice(adminMessage, "Transfer report rejected.", "success");
          await loadProjects();
        } catch (error) { setNotice(adminMessage, error.message, "error"); }
      })
    );
  }
  if (actions.childElementCount) item.append(actions);
  return item;
}

function makeProjectCard(project) {
  const card = document.createElement("article");
  card.className = "admin-project";
  const header = document.createElement("header");
  header.className = "admin-project-head";
  const person = document.createElement("div");
  const name = document.createElement("h3");
  name.textContent = project.customerName;
  const contact = document.createElement("p");
  contact.textContent = `${project.customerEmail} · ${project.customerPhone}${project.projectBudgetPaise == null ? "" : ` · Customer budget ${money.format(project.projectBudgetPaise / 100)}`}`;
  person.append(name, contact);
  const id = document.createElement("span");
  id.className = "admin-project-id";
  id.textContent = project.id;
  header.append(person, id);
  const brief = document.createElement("p");
  brief.className = "project-brief";
  brief.textContent = `${project.projectType}: ${project.projectBrief}`;
  const finances = document.createElement("div");
  finances.className = "admin-finances";
  const values = [
    ["Verified", money.format(project.paidPaise / 100)],
    ["Agreed quote", project.totalPaise == null ? "Not set" : money.format(project.totalPaise / 100)],
    ["Balance", project.duePaise == null ? "Set quote first" : money.format(project.duePaise / 100)]
  ];
  values.forEach(([label, value]) => {
    const box = document.createElement("div");
    const span = document.createElement("span");
    const strong = document.createElement("strong");
    span.textContent = label;
    strong.textContent = value;
    box.append(span, strong);
    finances.append(box);
  });

  const quoteForm = document.createElement("form");
  quoteForm.className = "quote-form";
  quoteForm.innerHTML = `
    <label class="quote-price"><span>Agreed total project price (₹)</span><input name="totalRupees" type="number" min="1" max="10000000" step="1" required /></label>
    <label><span>Private preview video key in R2</span><input name="previewObjectKey" maxlength="180" /></label>
    <label><span>Private final video key in R2</span><input name="finalObjectKey" maxlength="180" /></label>
    <button class="pay-button" type="submit"><span>Save price and video keys</span><span aria-hidden="true">→</span></button>
  `;
  quoteForm.querySelector('[name="totalRupees"]').value = project.totalPaise == null ? "" : String(project.totalPaise / 100);
  quoteForm.querySelector('[name="previewObjectKey"]').placeholder = project.previewObjectKey ? "Saved — leave blank to keep" : "project-id/preview.mp4";
  quoteForm.querySelector('[name="finalObjectKey"]').placeholder = project.finalObjectKey ? "Saved — leave blank to keep" : "project-id/final.mp4";
  const quoteKeysNote = document.createElement("p");
  quoteKeysNote.className = "payment-meta quote-keys-note";
  quoteKeysNote.textContent = `Saved preview key: ${project.previewObjectKey || "none"} · Saved final key: ${project.finalObjectKey || "none"}. Leave a video key blank to keep its current value.`;
  quoteForm.append(quoteKeysNote);
  quoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    try {
      await api("POST", {
        action: "set-quote",
        projectId: project.id,
        totalRupees: Number(data.get("totalRupees")),
        previewObjectKey: String(data.get("previewObjectKey") || "").trim(),
        finalObjectKey: String(data.get("finalObjectKey") || "").trim()
      });
      setNotice(adminMessage, "Project price and media settings saved.", "success");
      await loadProjects();
    } catch (error) { setNotice(adminMessage, error.message, "error"); }
  });

  const paymentSection = document.createElement("section");
  paymentSection.className = "payment-review-list";
  const paymentTitle = document.createElement("h4");
  paymentTitle.textContent = "UPI transfer reports — verify against your bank transaction list";
  paymentSection.append(paymentTitle);
  if (project.payments.length) project.payments.forEach((payment) => paymentSection.append(renderPayment(payment, project.id)));
  else {
    const empty = document.createElement("p");
    empty.className = "payment-meta";
    empty.textContent = "No UPI transfer has been reported yet.";
    paymentSection.append(empty);
  }

  const footer = document.createElement("div");
  footer.className = "admin-project-footer";
  const note = document.createElement("p");
  note.textContent = "The portal link is shown to the customer after booking. Rotate only if they lose it; the previous link will stop working.";
  const rotate = makeButton("Replace customer link", "copy-portal-button", async () => {
    if (!window.confirm("Create a replacement link? The customer's previous private link will stop working.")) return;
    try {
      const result = await api("POST", { action: "rotate-link", projectId: project.id });
      const output = document.createElement("div");
      output.className = "portal-link-output";
      const input = document.createElement("input");
      input.readOnly = true;
      input.value = result.portalUrl;
      input.setAttribute("aria-label", "New private customer portal link");
      const copy = makeButton("Copy link", "copy-portal-button", async () => {
        try { await navigator.clipboard.writeText(result.portalUrl); copy.textContent = "Copied"; }
        catch { input.select(); document.execCommand("copy"); copy.textContent = "Copied"; }
      });
      output.append(input, copy);
      footer.append(output);
      rotate.disabled = true;
      rotate.textContent = "New link created";
      setNotice(adminMessage, "New link created. Send it to the customer privately; the old link is invalid.", "success");
    } catch (error) { setNotice(adminMessage, error.message, "error"); }
  });
  footer.append(note, rotate);
  card.append(header, brief, finances, quoteForm, paymentSection, footer);
  return card;
}

async function loadProjects() {
  try {
    const data = await api();
    projectList.replaceChildren();
    if (!data.projects?.length) {
      const empty = document.createElement("p");
      empty.className = "empty-projects";
      empty.textContent = "No booking requests yet.";
      projectList.append(empty);
    } else data.projects.forEach((project) => projectList.append(makeProjectCard(project)));
  } catch (error) {
    setNotice(adminMessage, error.message, "error");
    if (error.message.includes("Admin access")) {
      dashboard.hidden = true;
      authPanel.hidden = false;
      setNotice(loginMessage, "Your admin key was not accepted. Enter it again.", "error");
    }
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = document.querySelector("#admin-key").value;
  setNotice(loginMessage, "Checking admin access…");
  try {
    await api();
    authPanel.hidden = true;
    dashboard.hidden = false;
    setNotice(loginMessage, "");
    await loadProjects();
  } catch (error) {
    adminKey = "";
    document.querySelector("#admin-key").value = "";
    setNotice(loginMessage, error.message, "error");
  }
});

document.querySelector("#admin-refresh").addEventListener("click", loadProjects);
