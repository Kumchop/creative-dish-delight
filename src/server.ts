import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { CartLine, OrderDetails } from "./lib/menu";

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
};

type SerializedOrderMessage = {
  ok: boolean;
  orderId?: string;
  queued: boolean;
  message: string;
};

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

const isOrderPayload = (value: unknown): value is OrderDetails & { lines: CartLine[] } => {
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

const normalizeOrder = (value: OrderDetails & { lines: CartLine[] }): OrderSubmission => {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: value.name.trim(),
    phone: value.phone.trim(),
    email: value.email?.trim() || undefined,
    orderType: value.orderType,
    address: value.address?.trim() || undefined,
    time: value.time?.trim() || undefined,
    notes: value.notes?.trim() || undefined,
    lines: value.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      name: line.id,
      priceKobo: 0,
    })),
  };
};

const buildOrderSummary = (order: OrderSubmission): string => {
  const lines = order.lines
    .map((line) => `• ${line.quantity} × ${line.name}`)
    .join("\n");

  return [
    "New Kumchop order request",
    "",
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    order.email ? `Email: ${order.email}` : undefined,
    `Order type: ${order.orderType === "delivery" ? "Delivery" : "Pickup"}`,
    order.orderType === "delivery" && order.address ? `Delivery address: ${order.address}` : undefined,
    order.time ? `Preferred time: ${order.time}` : undefined,
    "",
    "Items:",
    lines || "No items",
    order.notes ? `\nNotes: ${order.notes}` : undefined,
    "",
    "Please confirm this order.",
  ]
    .filter((piece): piece is string => typeof piece === "string" && piece.length > 0)
    .join("\n");
};

const upsertOrder = (order: OrderSubmission) => {
  const globalWithOrders = globalThis as typeof globalThis & {
    __kumchopOrders?: OrderSubmission[];
  };

  globalWithOrders.__kumchopOrders ??= [];
  globalWithOrders.__kumchopOrders.push(order);
};

const maybeSendWhatsAppToRestaurant = async (order: OrderSubmission): Promise<void> => {
  const token = getEnv("WHATSAPP_CLOUD_TOKEN") ?? getEnv("WHATSAPP_TOKEN");
  const phoneNumberId = getEnv("WHATSAPP_PHONE_NUMBER_ID");
  const recipient = getEnv("WHATSAPP_TO_NUMBER") ?? getEnv("WHATSAPP_RECEIPIENT_NUMBER");

  if (!token || !phoneNumberId || !recipient) return;

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
    const text = await response.text();
    throw new Error(`WhatsApp API rejected the order notification: ${response.status} ${text}`);
  }
};

const handleOrderSubmission = async (request: Request): Promise<Response> => {
  try {
    const payload = (await request.json()) as unknown;
    if (!isOrderPayload(payload)) {
      return new Response(
        JSON.stringify({
          ok: false,
          queued: false,
          message: "Invalid order payload. Missing lines, customer name, phone, or order type.",
        } satisfies SerializedOrderMessage),
        {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }

    const order = normalizeOrder(payload);
    upsertOrder(order);

    try {
      await maybeSendWhatsAppToRestaurant(order);
    } catch (error) {
      console.warn("Order stored but WhatsApp notification did not send:", error);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        orderId: order.id,
        queued: true,
        message: "Order received and queued for the restaurant.",
      } satisfies SerializedOrderMessage),
      {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        ok: false,
        queued: false,
        message: "There was a problem processing the order.",
      } satisfies SerializedOrderMessage),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
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
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
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
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
