// src/server.ts
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { OrderDetails } from "./lib/menu";
import { menuRecords } from "./lib/menu-data";
import { ensureSchema, insertOrder, listOrders, getOrder, updateOrderStatus } from "@/lib/db-d1";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let schemaEnsured = false;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => (m.default ?? m) as ServerEntry);
  }
  return serverEntryPromise;
}

function runtimeEnv(envParam: any, key: string) {
  if (envParam && typeof envParam[key] !== "undefined") return envParam[key];
  return typeof process !== "undefined" ? (process.env as any)[key] : undefined;
}

function atobPoly(b64: string) {
  if (typeof atob === "function") return atob(b64);
  // Node fallback for local dev
  const buf = Buffer.from(b64, "base64");
  return buf.toString("utf8");
}

function parseBasicAuth(request: Request): { user: string; pass: string } | null {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) return null;
  try {
    const b64 = auth.slice(6);
    const decoded = atobPoly(b64);
    const sep = decoded.indexOf(":");
    if (sep === -1) return null;
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    return { user, pass };
  } catch {
    return null;
  }
}

function requireAdminAuth(request: Request, envParam: any): { ok: true } | { ok: false; response: Response } {
  const creds = parseBasicAuth(request);
  const adminUser = runtimeEnv(envParam, "ADMIN_USER");
  const adminPass = runtimeEnv(envParam, "ADMIN_PASS");
  if (!adminUser || !adminPass) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ ok: false, message: "Admin credentials not configured on server." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  if (!creds) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ ok: false, message: "Authentication required." }), {
        status: 401,
        headers: { "content-type": "application/json", "WWW-Authenticate": 'Basic realm="Kumchop admin"' },
      }),
    };
  }
  if (creds.user !== adminUser || creds.pass !== adminPass) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ ok: false, message: "Invalid credentials." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  return { ok: true };
}

const isOrderPayload = (value: unknown): value is OrderDetails & { lines: unknown[] } => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.lines) || candidate.lines.length === 0) return false;
  if (typeof candidate.name !== "string" || candidate.name.trim().length < 2) return false;
  if (typeof candidate.phone !== "string" || candidate.phone.trim().length < 7) return false;
  if (!candidate.orderType || (candidate.orderType !== "pickup" && candidate.orderType !== "delivery")) {
    return false;
  }
  return true;
};

const resolveLine = (line: any) => {
  const rec = menuRecords.find((r) => r.id === line.id);
  const name = (rec && rec.name) || (typeof line.name === "string" && line.name) || line.id;
  const priceKobo = rec && typeof rec.priceKobo === "number" ? rec.priceKobo : typeof line.priceKobo === "number" ? line.priceKobo : 0;
  const qty = Number.isInteger(line.quantity) ? Math.max(0, line.quantity) : 0;
  return { id: line.id, quantity: qty, name, priceKobo };
};

function buildOrderSummary(order: any) {
  const lines = order.lines?.map((line: any) => `• ${line.quantity} × ${line.name} @ ₦${Math.round(line.priceKobo / 100)}`).join("\n") ?? "";
  return [
    "*New Kumchop order request*",
    "",
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    order.email ? `Email: ${order.email}` : undefined,
    `Order type: ${order.orderType === "delivery" ? "Delivery" : "Pickup"}`,
    order.orderType === "delivery" && order.address ? `Delivery address: ${order.address}` : undefined,
    order.time ? `Preferred time: ${order.time}` : undefined,
    "",
    "*Items*",
    lines || "No items",
    "",
    `Subtotal: ₦${Math.round(order.subtotalKobo / 100)}`,
    order.deliveryFeeKobo === null ? `Delivery fee: To be confirmed` : `Delivery fee: ₦${Math.round(order.deliveryFeeKobo / 100)}`,
    `Total: ₦${Math.round(order.totalKobo / 100)}`,
    order.notes ? `\nNotes: ${order.notes}` : undefined,
    "",
    "Please confirm this order.",
  ]
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join("\n");
}

async function notifySlack(envParam: any, order: any): Promise<boolean> {
  const webhook = runtimeEnv(envParam, "SLACK_WEBHOOK_URL");
  if (!webhook) return false;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: buildOrderSummary(order) }),
    });
    return res.ok;
  } catch (err) {
    console.warn("Slack notification failed", err);
    return false;
  }
}

async function maybeSendWhatsAppToRestaurant(envParam: any, order: any): Promise<boolean> {
  const token = runtimeEnv(envParam, "WHATSAPP_CLOUD_TOKEN") ?? runtimeEnv(envParam, "WHATSAPP_TOKEN");
  const phoneNumberId = runtimeEnv(envParam, "WHATSAPP_PHONE_NUMBER_ID");
  const recipient = runtimeEnv(envParam, "WHATSAPP_TO_NUMBER") ?? runtimeEnv(envParam, "WHATSAPP_RECEIPIENT_NUMBER");

  if (!token || !phoneNumberId || !recipient) return false;

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: {
          body: buildOrderSummary(order),
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      console.warn(`WhatsApp API rejected the order notification: ${response.status} ${text}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("WhatsApp API request failed", err);
    return false;
  }
}

async function persistOrder(envParam: any, order: any) {
  try {
    if (!schemaEnsured) {
      await ensureSchema(envParam);
      schemaEnsured = true;
    }
  } catch (err) {
    console.warn("ensureSchema failed:", err);
  }

  await insertOrder(envParam, order);
}

async function handleOrderSubmission(request: Request, envParam: any): Promise<Response> {
  try {
    const payload = (await request.json()) as unknown;
    if (!isOrderPayload(payload)) {
      return new Response(JSON.stringify({ ok: false, queued: false, message: "Invalid order payload. Missing lines, customer name, phone, or order type." }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const value = payload as OrderDetails & { lines: unknown[] };
    const lines = value.lines.map((l) => resolveLine(l));
    const subtotalKobo = lines.reduce((t, l) => t + l.priceKobo * l.quantity, 0);
    const deliveryFeeKobo = null;
    const totalKobo = subtotalKobo + (deliveryFeeKobo ?? 0);

    const order = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: value.name.trim(),
      phone: value.phone.trim(),
      email: (value.email as string | undefined)?.trim() || undefined,
      orderType: value.orderType,
      address: (value.address as string | undefined)?.trim() || undefined,
      time: (value.time as string | undefined)?.trim() || undefined,
      notes: (value.notes as string | undefined)?.trim() || undefined,
      lines,
      subtotalKobo,
      deliveryFeeKobo,
      totalKobo,
    } as const;

    await persistOrder(envParam, order);

    let notified = false;
    try {
      notified = await maybeSendWhatsAppToRestaurant(envParam, order);
      if (!notified) {
        const slackOk = await notifySlack(envParam, order);
        if (!slackOk) console.warn("Order notification failed for both WhatsApp and Slack.");
      }
    } catch (err) {
      console.warn("Notification attempt failed", err);
    }

    return new Response(JSON.stringify({ ok: true, orderId: order.id, queued: true, message: "Order received and queued for the restaurant.", notified }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ok: false, queued: false, message: "There was a problem processing the order." }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

async function handleAdminApi(request: Request, envParam: any, url: URL): Promise<Response> {
  const auth = requireAdminAuth(request, envParam);
  if (!auth.ok) return auth.response;

  if (request.method === "GET" && url.pathname === "/api/admin/orders") {
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    try {
      const rows = await listOrders(envParam, limit, offset);
      return new Response(JSON.stringify({ ok: true, orders: rows }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ ok: false, message: "Could not list orders." }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/admin/orders/")) {
    const parts = url.pathname.split("/");
    const id = parts[parts.length - 1];
    try {
      const ord = await getOrder(envParam, id);
      if (!ord) return new Response(JSON.stringify({ ok: false, message: "Order not found." }), { status: 404, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, order: ord }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ ok: false, message: "Could not fetch order." }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/admin/orders/") && url.pathname.endsWith("/status")) {
    const parts = url.pathname.split("/");
    const id = parts[parts.length - 2];
    try {
      const body = await request.json();
      const status = body?.status as string | undefined;
      if (!status) return new Response(JSON.stringify({ ok: false, message: "Missing status." }), { status: 400, headers: { "content-type": "application/json" } });
      const ok = await updateOrderStatus(envParam, id, status);
      if (!ok) return new Response(JSON.stringify({ ok: false, message: "Order not found or not updated." }), { status: 404, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ ok: false, message: "Could not update status." }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/admin/orders/") && url.pathname.endsWith("/resend")) {
    const parts = url.pathname.split("/");
    const id = parts[parts.length - 2];
    try {
      const ord = await getOrder(envParam, id);
      if (!ord) return new Response(JSON.stringify({ ok: false, message: "Order not found." }), { status: 404, headers: { "content-type": "application/json" } });

      let notified = false;
      try {
        notified = await maybeSendWhatsAppToRestaurant(envParam, ord);
        if (!notified) {
          const slackOk = await notifySlack(envParam, ord);
          if (!slackOk) console.warn("Resend: notification failed for both WhatsApp and Slack.");
        }
      } catch (err) {
        console.warn("Resend notification attempt failed", err);
      }

      return new Response(JSON.stringify({ ok: true, notified }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ ok: false, message: "Could not resend notifications." }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({ ok: false, message: "Unsupported admin API route or method." }), { status: 404, headers: { "content-type": "application/json" } });
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    if (!(payload.unhandled === true && payload.message === "HTTPError")) return response;
  } catch {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}

export default {
  async fetch(request: Request, env: any, ctx: unknown) {
    const url = new URL(request.url);

    // Debug endpoint to check D1 binding and tables. Remove after debugging.
    if (url.pathname === "/_debug/d1") {
      const d1 = env?.KUMCHOP;
      // collect visible env keys to help debugging (temporary)
      let envKeys: string[] = [];
      try {
        envKeys = Object.keys(env || {}).slice(0, 200);
      } catch (e) {
        // ignore
      }
      const result: any = { hasBinding: !!d1, timestamp: new Date().toISOString(), envKeys };
      if (!d1) {
        return new Response(JSON.stringify({ ...result, error: "KUMCHOP binding is missing" }), { status: 500, headers: { "content-type": "application/json" } });
      }
      try {
        const res = await d1.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tables = (res?.results ?? []).map((r: any) => r.name ?? r);
        return new Response(JSON.stringify({ ...result, tables }), { headers: { "content-type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ ...result, error: String(err) }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }

    if (url.pathname.startsWith("/api/admin/orders")) {
      return await handleAdminApi(request, env, url);
    }

    if (request.method === "POST" && url.pathname === "/api/orders") {
      return await handleOrderSubmission(request, env);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  },
};
