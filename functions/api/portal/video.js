import { findProject, json, paidTotal } from "../../_portal-utils.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB || !env.PROJECT_MEDIA) return json({ error: "Private video storage is not configured yet." }, 503);
  const url = new URL(request.url);
  const project = await findProject(env.DB, url.searchParams.get("token") ?? "");
  if (!project) return json({ error: "This project link is invalid or has been replaced." }, 404);

  const kind = url.searchParams.get("kind");
  const paid = await paidTotal(env.DB, project.id);
  const total = project.total_price_paise == null ? null : Number(project.total_price_paise);
  let key = "";
  if (kind === "preview" && paid > 0) key = project.preview_object_key ?? "";
  if (kind === "final" && total != null && paid >= total) key = project.final_object_key ?? "";
  if (!key) return json({ error: "This video is not available yet." }, 403);

  const object = await env.PROJECT_MEDIA.get(key, { range: request.headers });
  if (!object || !("body" in object)) return json({ error: "The project video could not be found." }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", object.httpMetadata?.contentType || "video/mp4");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  if (object.range) {
    const start = Number(object.range.offset ?? 0);
    const length = Number(object.range.length ?? 0);
    headers.set("Content-Range", `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
  } else {
    headers.set("Content-Length", String(object.size));
  }
  const download = kind === "final" && url.searchParams.get("download") === "1";
  headers.set("Content-Disposition", download ? 'attachment; filename="project-delivery.mp4"' : "inline");
  return new Response(object.body, { status: object.range ? 206 : 200, headers });
}
