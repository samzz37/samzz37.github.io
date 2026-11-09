import { cleanText, json, newToken, portalUrl, readJson, sameOrigin, tokenDigest } from "../_portal-utils.js";

const projectTypes = new Set(["starter", "business", "custom"]);

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "This request was not accepted." }, 403);
  if (!env.DB) return json({ error: "Project booking is being set up. Please message Sam on WhatsApp for now." }, 503);

  const form = await readJson(request);
  if (form.error) return json({ error: form.error }, 400);

  const customerName = cleanText(form.customerName, 80);
  const customerEmail = cleanText(form.customerEmail, 254).toLowerCase();
  const customerPhone = cleanText(form.customerPhone, 24);
  const projectType = cleanText(form.projectType, 20);
  const projectBrief = cleanText(form.projectBrief, 1000);
  const budgetText = cleanText(form.projectBudget, 12);
  const advanceRupees = Number(form.advanceAmountRupees);

  if (customerName.length < 2) return json({ error: "Enter your name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return json({ error: "Enter a valid email address." }, 400);
  if (!/^[+()\d\s-]{8,24}$/.test(customerPhone) || customerPhone.replace(/\D/g, "").length < 8) return json({ error: "Enter a valid phone or WhatsApp number." }, 400);
  if (!projectTypes.has(projectType)) return json({ error: "Choose a project type." }, 400);
  if (projectBrief.length < 20) return json({ error: "Describe the project in at least 20 characters." }, 400);
  if (!Number.isSafeInteger(advanceRupees) || advanceRupees < 300 || advanceRupees > 500000) return json({ error: "The advance must be ₹300–₹5,00,000 in whole rupees." }, 400);
  if (budgetText && (!/^\d{1,8}$/.test(budgetText) || Number(budgetText) > 10000000)) return json({ error: "Enter a valid project budget or leave it blank." }, 400);

  const projectId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const token = newToken();
  const budgetPaise = budgetText ? Number(budgetText) * 100 : null;
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO projects
        (id, portal_token_hash, customer_name, customer_email, customer_phone, project_type, project_brief, project_budget_paise, requested_advance_paise, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(projectId, await tokenDigest(token), customerName, customerEmail, customerPhone, projectType, projectBrief, budgetPaise, advanceRupees * 100, now, now),
      env.DB.prepare(`INSERT INTO project_payments (id, project_id, purpose, amount_paise, status, created_at)
        VALUES (?, ?, 'advance', ?, 'awaiting_transfer', ?)`)
        .bind(paymentId, projectId, advanceRupees * 100, now)
    ]);
  } catch {
    return json({ error: "Could not save the booking request. Please try again or message Sam." }, 503);
  }

  return json({
    projectId,
    paymentId,
    advanceAmountRupees: advanceRupees,
    portalUrl: portalUrl(request, token),
    status: "awaiting_transfer"
  }, 201);
}
