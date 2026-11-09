const MIN_ADVANCE_RUPEES = 300;
const MAX_ADVANCE_RUPEES = 500000;
const PROJECT_TYPES = new Set(["starter", "business", "custom"]);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) return jsonResponse({ error: "Request origin was not accepted." }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return jsonResponse({ error: "Send booking details as JSON." }, 415);
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return jsonResponse({ error: "Secure payments are not configured yet. Please message Sam to arrange your booking." }, 503);

  let form;
  try {
    const bodyText = await request.text();
    if (bodyText.length > 12000) return jsonResponse({ error: "Booking details are too large." }, 413);
    form = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: "Enter valid booking details and try again." }, 400);
  }

  const customerName = cleanText(form.customerName, 80);
  const customerEmail = cleanText(form.customerEmail, 254).toLowerCase();
  const customerPhone = cleanText(form.customerPhone, 24);
  const projectType = cleanText(form.projectType, 20);
  const projectBrief = cleanText(form.projectBrief, 1000);
  const projectBudget = cleanText(form.projectBudget, 12);
  const advanceAmountRupees = Number(form.advanceAmountRupees);

  if (customerName.length < 2) return jsonResponse({ error: "Enter your name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return jsonResponse({ error: "Enter a valid email address." }, 400);
  if (!/^[+()\d\s-]{8,24}$/.test(customerPhone) || customerPhone.replace(/\D/g, "").length < 8) return jsonResponse({ error: "Enter a valid phone or WhatsApp number." }, 400);
  if (!PROJECT_TYPES.has(projectType)) return jsonResponse({ error: "Choose one of the listed project types." }, 400);
  if (projectBrief.length < 20) return jsonResponse({ error: "Please describe the project in at least 20 characters." }, 400);
  if (!Number.isSafeInteger(advanceAmountRupees) || advanceAmountRupees < MIN_ADVANCE_RUPEES || advanceAmountRupees > MAX_ADVANCE_RUPEES) {
    return jsonResponse({ error: "The advance must be a whole-rupee amount from ₹300 to ₹5,00,000." }, 400);
  }
  if (projectBudget && (!/^\d{1,8}$/.test(projectBudget) || Number(projectBudget) > 10000000)) {
    return jsonResponse({ error: "Enter a valid total project budget or leave that field blank." }, 400);
  }

  const notes = {
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    project_type: projectType,
    project_brief: projectBrief.slice(0, 256)
  };
  if (projectBudget) notes.project_budget_inr = projectBudget;

  const receipt = `booking_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const authorization = `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
  let razorpayResponse;
  try {
    razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: advanceAmountRupees * 100, currency: "INR", receipt, notes })
    });
  } catch {
    return jsonResponse({ error: "The payment service is temporarily unavailable. Please try again." }, 502);
  }

  if (!razorpayResponse.ok) return jsonResponse({ error: "Razorpay could not create the order. Check your payment account setup or try again later." }, 502);
  const order = await razorpayResponse.json();
  if (!order.id || order.amount !== advanceAmountRupees * 100 || order.currency !== "INR") {
    return jsonResponse({ error: "The payment service returned an invalid order." }, 502);
  }

  return jsonResponse({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID });
}
