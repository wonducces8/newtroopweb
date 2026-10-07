const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] ?? char));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const expectedSecret = Deno.env.get("PHOTO_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-webhook-secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const recipient = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
  if (!apiKey || !from || !recipient) {
    return new Response("Email notification secrets are not configured", { status: 500, headers: corsHeaders });
  }

  let payload: { type?: string; table?: string; record?: Record<string, unknown> };
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid webhook payload", { status: 400, headers: corsHeaders });
  }
  if (payload.type !== "INSERT" || payload.table !== "photo_access_requests" || !payload.record) {
    return new Response("Ignored event", { status: 200, headers: corsHeaders });
  }

  const name = String(payload.record.display_name || "Name not provided");
  const email = String(payload.record.email || "Email not provided");
  const requestId = String(payload.record.user_id || "");
  const adminUrl = Deno.env.get("SITE_ADMIN_URL") || "";
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeUrl = /^https:\/\//.test(adminUrl) ? adminUrl : "";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `New Troop 1941 account request from ${name}`,
      text: `A new member account is waiting for approval.\n\nName: ${name}\nEmail: ${email}\nAccount ID: ${requestId}\n\nSign in to the troop admin page to review permissions.`,
      html: `<h2>New member account request</h2><p><strong>Name:</strong> ${safeName}<br><strong>Email:</strong> ${safeEmail}</p><p>A Troop 1941 account is waiting for approval. Sign in to the site administrator page to assign its permissions.</p>${safeUrl ? `<p><a href="${escapeHtml(safeUrl)}">Open admin page</a></p>` : ""}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Resend request failed:", detail);
    return new Response("Could not send access request notification", { status: 502, headers: corsHeaders });
  }
  return new Response("Notification sent", { status: 200, headers: corsHeaders });
});
