function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  let difference = 0;
  for (let index = 0; index < 64; index += 1) {
    difference |= left.toLowerCase().charCodeAt(index) ^ right.toLowerCase().charCodeAt(index);
  }
  return difference === 0;
}

async function createExpectedSignature(orderId, paymentId, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const message = new TextEncoder().encode(`${orderId}|${paymentId}`);
  return toHex(await crypto.subtle.sign("HMAC", key, message));
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) return jsonResponse({ error: "Request origin was not accepted." }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return jsonResponse({ error: "Send payment response as JSON." }, 415);
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return jsonResponse({ error: "Payment verification is not configured yet." }, 503);

  let payment;
  try {
    const bodyText = await request.text();
    if (bodyText.length > 3000) return jsonResponse({ error: "Payment response is invalid." }, 413);
    payment = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: "Payment response is invalid." }, 400);
  }

  const orderId = String(payment.razorpay_order_id ?? "");
  const paymentId = String(payment.razorpay_payment_id ?? "");
  const signature = String(payment.razorpay_signature ?? "");
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return jsonResponse({ error: "Payment response is incomplete." }, 400);
  }

  const expectedSignature = await createExpectedSignature(orderId, paymentId, env.RAZORPAY_KEY_SECRET);
  if (!safeEqualHex(expectedSignature, signature)) return jsonResponse({ error: "The payment signature could not be verified." }, 400);

  const authorization = `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
  const headers = { Authorization: authorization };
  let paymentResponse;
  let orderResponse;
  try {
    [paymentResponse, orderResponse] = await Promise.all([
      fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers }),
      fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers })
    ]);
  } catch {
    return jsonResponse({ error: "Payment verification is temporarily unavailable. Keep your order reference and contact Sam." }, 502);
  }

  if (!paymentResponse.ok || !orderResponse.ok) return jsonResponse({ error: "Razorpay could not confirm this payment yet. Keep your order reference and contact Sam." }, 502);
  const [paymentDetails, orderDetails] = await Promise.all([paymentResponse.json(), orderResponse.json()]);
  if (paymentDetails.order_id !== orderId || paymentDetails.currency !== "INR" || paymentDetails.amount !== orderDetails.amount) {
    return jsonResponse({ error: "The payment does not match the booking order." }, 400);
  }

  if (paymentDetails.status === "captured" && orderDetails.status === "paid") {
    return jsonResponse({ verified: true, captured: true, orderId, amount: paymentDetails.amount });
  }
  if (paymentDetails.status === "authorized") {
    return jsonResponse({ verified: true, captured: false, orderId }, 202);
  }
  return jsonResponse({ error: "The payment has not been captured. Please check Razorpay or contact Sam with your order reference." }, 409);
}
