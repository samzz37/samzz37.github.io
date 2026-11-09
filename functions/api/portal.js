import { findProject, json, paidTotal } from "../_portal-utils.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "The project portal is being set up. Please contact Sam." }, 503);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const project = await findProject(env.DB, token);
  if (!project) return json({ error: "This project link is invalid or has been replaced. Contact Sam for a new link." }, 404);

  const [paidPaise, paymentRows] = await Promise.all([
    paidTotal(env.DB, project.id),
    env.DB.prepare(`SELECT id, purpose, amount_paise, utr, status, created_at, verified_at
      FROM project_payments WHERE project_id = ? ORDER BY created_at DESC`).bind(project.id).all()
  ]);
  const totalPaise = project.total_price_paise == null ? null : Number(project.total_price_paise);
  const duePaise = totalPaise == null ? null : Math.max(totalPaise - paidPaise, 0);
  return json({
    project: {
      id: project.id,
      customerName: project.customer_name,
      projectType: project.project_type,
      projectBrief: project.project_brief,
      createdAt: project.created_at,
      totalPaise,
      paidPaise,
      duePaise,
      initialAdvancePaise: Number(project.requested_advance_paise),
      previewAvailable: paidPaise > 0 && Boolean(project.preview_object_key),
      finalAvailable: totalPaise != null && paidPaise >= totalPaise && Boolean(project.final_object_key)
    },
    payments: paymentRows.results ?? []
  });
}
