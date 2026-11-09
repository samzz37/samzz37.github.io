import { cleanText, findProject, json, paidTotal, readJson, sameOrigin } from "../../_portal-utils.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "This request was not accepted." }, 403);
  if (!env.DB) return json({ error: "The project portal is being set up. Please contact Sam." }, 503);
  const form = await readJson(request, 5000);
  if (form.error) return json({ error: form.error }, 400);

  const project = await findProject(env.DB, String(form.token ?? ""));
  if (!project) return json({ error: "This project link is invalid or has been replaced." }, 404);
  const utr = cleanText(form.utr, 50).replace(/\s/g, "");
  const amountRupees = Number(form.amountRupees);
  const amountPaise = amountRupees * 100;
  if (!/^[A-Za-z0-9/-]{6,50}$/.test(utr)) return json({ error: "Enter the UPI transaction reference (UTR) from your payment app." }, 400);
  if (!Number.isSafeInteger(amountRupees) || amountRupees < 1 || amountRupees > 10000000) return json({ error: "Enter the exact whole-rupee amount you transferred." }, 400);

  const paid = await paidTotal(env.DB, project.id);
  const pendingReport = await env.DB.prepare("SELECT id FROM project_payments WHERE project_id = ? AND status = 'reported' LIMIT 1")
    .bind(project.id).first();
  if (pendingReport) return json({ error: "A transfer is already waiting for Sam’s review. Wait for its status before submitting another." }, 409);
  const total = project.total_price_paise == null ? null : Number(project.total_price_paise);
  if (paid === 0) {
    const advance = Number(project.requested_advance_paise);
    if (amountPaise !== advance) return json({ error: `Report the requested advance of ₹${advance / 100}.` }, 400);
    const openAdvance = await env.DB.prepare(`SELECT id FROM project_payments WHERE project_id = ? AND purpose = 'advance' AND status = 'awaiting_transfer' ORDER BY created_at ASC LIMIT 1`)
      .bind(project.id).first();
    try {
      if (openAdvance) {
        const result = await env.DB.prepare(`UPDATE project_payments SET status = 'reported', utr = ? WHERE id = ? AND status = 'awaiting_transfer'`)
          .bind(utr, openAdvance.id).run();
        if (!result.meta?.changes) return json({ error: "This transfer has already been submitted for review." }, 409);
      } else {
        await env.DB.prepare(`INSERT INTO project_payments (id, project_id, purpose, amount_paise, utr, status, created_at)
          VALUES (?, ?, 'advance', ?, ?, 'reported', ?)`)
          .bind(crypto.randomUUID(), project.id, amountPaise, utr, new Date().toISOString()).run();
      }
    } catch {
      return json({ error: "That UPI reference has already been submitted. Check it and try again." }, 409);
    }
    return json({ submitted: true, status: "reported" }, 201);
  }

  if (total == null) return json({ error: "Sam is setting the agreed project price. You can submit the balance payment after it appears here." }, 409);
  const due = Math.max(total - paid, 0);
  if (due <= 0) return json({ error: "The project is already fully paid." }, 409);
  if (amountPaise > due) return json({ error: "The reported amount cannot be greater than the remaining balance." }, 400);
  try {
    await env.DB.prepare(`INSERT INTO project_payments (id, project_id, purpose, amount_paise, utr, status, created_at)
      VALUES (?, ?, 'balance', ?, ?, 'reported', ?)`)
      .bind(crypto.randomUUID(), project.id, amountPaise, utr, new Date().toISOString()).run();
  } catch {
    return json({ error: "That UPI reference has already been submitted. Check it and try again." }, 409);
  }
  return json({ submitted: true, status: "reported" }, 201);
}
