import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { CartLine, OrderDetails } from "./lib/menu";
import { menuRecords } from "./lib/menu-data";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type OrderSubmission = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email?: string;
  orderType: "pickup" | "delivery";
  address?: string;
  time?: string;
  notes?: string;
  lines: Array<{ id: string; quantity: number; name: string; priceKobo: number }>;
  subtotalKobo: number;
  deliveryFeeKobo: number | null;
  totalKobo: number;
};

const ORDERS_PATH = "src/data/orders.jsonl";

const getEnv = (key: string): string | undefined => {
  if (typeof process !== "undefined" && process.env && typeof process.env[key] === "string") {
    return process.env[key];
  }

  if (typeof import.meta !== "undefined") {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (env && typeof env[key] === "string") {
      return env[key];
    }
  }

  return undefined;
};

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
  const priceKobo = (rec && typeof rec.priceKobo === "number" ? rec.priceKobo : typeof line.priceKobo === "number" ? line.priceKobo : 0);
  const qty = Number.isInteger(line.quantity) ? Math.max(0, line.quantity) : 0;
  return { id: line.id, quantity: qty, name, priceKobo };
};

const normalizeOrder = (value: OrderDetails & { lines: unknown[] }): OrderSubmission => {
  const lines = value.lines.map((l) => resolveLine(l));
  const subtotalKobo = lines.reduce((t, l) => t + l.priceKobo * l.quantity, 0);
  const deliveryFeeKobo = null; // Keep using restaurant config on client/server if needed
  const totalKobo = subtotalKobo + (deliveryFeeKobo ?? 0);

  return {
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
  };
};

const appendOrderToFile = async (order: OrderSubmission): Promise<boolean> => {
  try {
    // Try Node fs.promises - works in Node environments. Use dynamic import so edge runtimes don't fail at import time.
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.dirname(ORDERS_PATH);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {}
    await fs.appendFile(ORDERS_PATH, JSON.stringify(order) + "\n", { encoding: "utf8" });
    return true;
  } catch (err) {
    console.warn("Could not write order to file system (this may be an edge/runtime limitation). Falling back to in-memory storage.", err);
    // Fall through to in-memory storage
    return false;
  }
};

const upsertOrder = async (order: OrderSubmission) => {
  const persisted = await appendOrderToFile(order);

  const globalWithOrders = globalThis as typeof globalThis & {
    __kumchopOrders?: OrderSubmission[];
  };

  globalWithOrders.__kumchopOrders ??= [];
  globalWithOrders.__kumchopOrders.push(order);

  return persisted;
};

const buildOrderSummary = (order: OrderSubmission): string => {
  const lines = order.lines
    .map((line) => `• ${line.quantity} × ${line.name} @ ₦${Math.round(line.priceKobo / 100)}`)
    .join("\n");

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
    .filter((piece): piece is string => typeof piece === "string" && piece.length > 0)
    .join("\n");
};

const notifySlack = async (order: OrderSubmission): Promise<boolean> => {
  const webhook = getEnv("SLACK_WEBHOOK_URL");
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
};

const maybeSendWhatsAppToRestaurant = async (order: OrderSubmission): Promise<boolean> => {
  const token = getEnv("WHATSAPP_CLOUD_TOKEN") ?? getEnv("WHATSAPP_TOKEN");
  const phoneNumberId = getEnv("WHATSAPP_PHONE_NUMBER_ID");
  const recipient = getEnv("WHATSAPP_TO_NUMBER") ?? getEnv("WHATSAPP_RECEIPIENT_NUMBER");

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
};

const handleOrderSubmission = async (request: Request): Promise<Response> => {
  try {
    const payload = (await request.json()) as unknown;
    if (!isOrderPayload(payload)) {
      return new Response(
        JSON.stringify({ ok: false, queued: false, message: "Invalid order payload. Missing lines, customer name, phone, or order type." }),
        { status: 400, headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }

    const order = normalizeOrder(payload);

    const persisted = await upsertOrder(order);

    // Try to notify via WhatsApp; if that fails, try Slack webhook as a fallback.
    let notified = false;
    try {
      notified = await maybeSendWhatsAppToRestaurant(order);
      if (!notified) {
        const slackOk = await notifySlack(order);
        if (!slackOk) console.warn("Order notification failed for both WhatsApp and Slack.");
      }
    } catch (err) {
      console.warn("Notification attempt failed", err);
    }

    return new Response(
      JSON.stringify({ ok: true, orderId: order.id, queued: true, message: "Order received and queued for the restaurant.", persisted, notified }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ ok: false, queued: false, message: "There was a problem processing the order." }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => (m.default ?? m) as ServerEntry);
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/orders") {
      return handleOrderSubmission(request);
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
