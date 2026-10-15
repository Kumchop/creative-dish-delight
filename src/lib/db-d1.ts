// Cloudflare D1 adapter for orders. Uses the D1 binding named `KUMCHOP`.
// The functions are async and return data in the same shape as the previous local adapter.

import type { OrderSubmission } from '@/server-types';

function rowToOrder(row: any) {
  if (!row) return null;
  const raw = row.raw_json ? JSON.parse(row.raw_json) : row.raw;
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    orderType: row.order_type,
    address: row.address ?? undefined,
    time: row.time ?? undefined,
    notes: row.notes ?? undefined,
    lines: raw?.lines ?? [],
    subtotalKobo: row.subtotal_kobo,
    deliveryFeeKobo: row.delivery_fee_kobo ?? null,
    totalKobo: row.total_kobo,
    status: row.status,
    raw,
  } as unknown as OrderSubmission & { status: string };
}

export async function ensureSchema(env: any) {
  const d1 = env?.KUMCHOP;
  if (!d1) throw new Error('Cloudflare D1 binding KUMCHOP is missing. Create the D1 database and bind it with the name KUMCHOP in your Pages/Worker project settings.');

  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      order_type TEXT NOT NULL,
      address TEXT,
      time TEXT,
      notes TEXT,
      subtotal_kobo INTEGER NOT NULL,
      delivery_fee_kobo INTEGER,
      total_kobo INTEGER NOT NULL,
      raw_json TEXT NOT NULL,
      status TEXT DEFAULT 'received'
    );
  `).run();
}

export async function insertOrder(env: any, order: OrderSubmission) {
  const d1 = env?.KUMCHOP;
  if (!d1) throw new Error('Cloudflare D1 binding KUMCHOP is missing. Create the D1 database and bind it with the name KUMCHOP in your Pages/Worker project settings.');
  const sql = `INSERT INTO orders (id, created_at, name, phone, email, order_type, address, time, notes, subtotal_kobo, delivery_fee_kobo, total_kobo, raw_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const raw = JSON.stringify(order);
  await d1.prepare(sql).bind(
    order.id,
    order.createdAt,
    order.name,
    order.phone,
    order.email ?? null,
    order.orderType,
    order.address ?? null,
    order.time ?? null,
    order.notes ?? null,
    order.subtotalKobo,
    order.deliveryFeeKobo,
    order.totalKobo,
    raw,
    'received',
  ).run();
  return true;
}

export async function listOrders(env: any, limit = 50, offset = 0) {
  const d1 = env?.KUMCHOP;
  if (!d1) throw new Error('Cloudflare D1 binding KUMCHOP is missing. Create the D1 database and bind it with the name KUMCHOP in your Pages/Worker project settings.');
  const sql = `SELECT id, created_at, name, phone, subtotal_kobo, total_kobo, status, raw_json FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const res = await d1.prepare(sql).bind(limit, offset).all();
  const rows = (res?.results ?? []) as any[];
  return rows.map(r => ({
    id: r.id,
    createdAt: r.created_at,
    name: r.name,
    phone: r.phone,
    subtotalKobo: r.subtotal_kobo,
    totalKobo: r.total_kobo,
    status: r.status,
    raw: JSON.parse(r.raw_json),
  }));
}

export async function getOrder(env: any, id: string) {
  const d1 = env?.KUMCHOP;
  if (!d1) throw new Error('Cloudflare D1 binding KUMCHOP is missing. Create the D1 database and bind it with the name KUMCHOP in your Pages/Worker project settings.');
  const sql = `SELECT * FROM orders WHERE id = ?`;
  const res = await d1.prepare(sql).bind(id).all();
  const row = (res?.results ?? [])[0];
  if (!row) return null;
  return rowToOrder(row);
}

export async function updateOrderStatus(env: any, id: string, status: string) {
  const d1 = env?.KUMCHOP;
  if (!d1) throw new Error('Cloudflare D1 binding KUMCHOP is missing. Create the D1 database and bind it with the name KUMCHOP in your Pages/Worker project settings.');
  const sql = `UPDATE orders SET status = ? WHERE id = ?`;
  const r = await d1.prepare(sql).bind(status, id).run();
  return (r && (r.success || (r.changes && r.changes > 0))) ?? true;
}
