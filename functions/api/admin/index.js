import { cleanText, json, paidTotal, readJson, requireAdmin, safeObjectKey, sameOrigin } from "../../_portal-utils.js";

function dbUnavailable(env) {
  return !env.DB;
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: "Admin access is required." }, env.PORTAL_ADMIN_KEY ? 401 : 503);
  if (dbUnavailable(env)) return json({ error: "The project database is not connected." }, 503);

  const [projects, payments] = await Promise.all([
    env.DB.prepare("SELECT * FROM projects ORDER BY created_at DESC LIMIT 100").all(),
    env.DB.prepare("SELECT id, project_id, purpose, amount_paise, utr, status, created_at, verified_at FROM project_payments ORDER BY created_at DESC LIMIT 500").all()
  ]);
  const paymentMap = new Map();
  for (const payment of payments.results ?? []) {
    if (!paymentMap.has(payment.project_id)) paymentMap.set(payment.project_id, []);
    paymentMap.get(payment.project_id).push(payment);
  }
  const result = [];
  for (const project of projects.results ?? []) {
    const paidPaise = await paidTotal(env.DB, project.id);
    const totalPaise = project.total_price_paise == null ? null : Number(project.total_price_paise);
    result.push({
      id: project.id,
      customerName: project.customer_name,
      customerEmail: project.customer_email,
      customerPhone: project.customer_phone,
      projectType: project.project_type,
      projectBrief: project.project_brief,
      createdAt: project.created_at,
      projectBudgetPaise: project.project_budget_paise == null ? null : Number(project.project_budget_paise),
      requestedAdvancePaise: Number(project.requested_advance_paise),
      totalPaise,
      paidPaise,
      duePaise: totalPaise == null ? null : Math.max(totalPaise - paidPaise, 0),
      previewObjectKey: project.preview_object_key ?? "",
      finalObjectKey: project.final_object_key ?? "",
      payments: paymentMap.get(project.id) ?? []
    });
  }
  return json({ projects: result });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "This request was not accepted." }, 403);
  if (!(await requireAdmin(request, env))) return json({ error: "Admin access is required." }, env.PORTAL_ADMIN_KEY ? 401 : 503);
  if (dbUnavailable(env)) return json({ error: "The project database is not connected." }, 503);
  const form = await readJson(request, 8000);
  if (form.error) return json({ error: form.error }, 400);
  const projectId = cleanText(form.projectId, 40);

  if (form.action === "set-quote") {
    const rupees = Number(form.totalRupees);
    if (!projectId || !Number.isSafeInteger(rupees) || rupees < 1 || rupees > 10000000) return json({ error: "Enter a valid whole-rupee project price." }, 400);
    const project = await env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
    if (!project) return json({ error: "Project not found." }, 404);
    const paid = await paidTotal(env.DB, projectId);
    if (rupees * 100 < paid) return json({ error: "The agreed project price cannot be lower than the payments already verified." }, 409);
    const previewKey = form.previewObjectKey ? safeObjectKey(form.previewObjectKey) : "";
    const finalKey = form.finalObjectKey ? safeObjectKey(form.finalObjectKey) : "";
    if (form.previewObjectKey && !previewKey) return json({ error: "The preview video key is invalid." }, 400);
    if (form.finalObjectKey && !finalKey) return json({ error: "The final video key is invalid." }, 400);
    await env.DB.prepare(`UPDATE projects SET total_price_paise = ?, preview_object_key = COALESCE(?, preview_object_key), final_object_key = COALESCE(?, final_object_key), updated_at = ? WHERE id = ?`)
      .bind(rupees * 100, previewKey || null, finalKey || null, new Date().toISOString(), projectId).run();
    return json({ saved: true });
  }

  if (form.action === "verify-payment" || form.action === "reject-payment") {
    const paymentId = cleanText(form.paymentId, 40);
    const payment = await env.DB.prepare("SELECT * FROM project_payments WHERE id = ?").bind(paymentId).first();
    if (!payment || payment.status !== "reported") return json({ error: "This payment is not awaiting review." }, 409);
    if (form.action === "verify-payment") {
      const project = await env.DB.prepare("SELECT total_price_paise FROM projects WHERE id = ?").bind(payment.project_id).first();
      const paid = await paidTotal(env.DB, payment.project_id);
      if (payment.purpose === "balance" && project?.total_price_paise == null) return json({ error: "Set the agreed project price before verifying a balance transfer." }, 409);
      if (project?.total_price_paise != null && paid + Number(payment.amount_paise) > Number(project.total_price_paise)) {
        return json({ error: "This amount would exceed the agreed project price. Check the transfer and project quote." }, 409);
      }
    }
    const nextStatus = form.action === "verify-payment" ? "verified" : "rejected";
    const result = await env.DB.prepare(`UPDATE project_payments SET status = ?, verified_at = ? WHERE id = ? AND status = 'reported'`)
      .bind(nextStatus, nextStatus === "verified" ? new Date().toISOString() : null, paymentId).run();
    if (!result.meta?.changes) return json({ error: "Payment status changed before this action completed. Refresh the list." }, 409);
    return json({ saved: true, status: nextStatus });
  }

  if (form.action === "rotate-link") {
    const project = await env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
    if (!project) return json({ error: "Project not found." }, 404);
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare("UPDATE projects SET portal_token_hash = ?, updated_at = ? WHERE id = ?")
      .bind(tokenHash, new Date().toISOString(), projectId).run();
    const portal = new URL(request.url);
    portal.pathname = "/project.html";
    portal.search = `?token=${encodeURIComponent(token)}`;
    return json({ saved: true, portalUrl: portal.toString() });
  }

  return json({ error: "Choose a supported admin action." }, 400);
}
