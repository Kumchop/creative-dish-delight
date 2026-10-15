import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { OrderSubmission } from '@/server-types';

const DB_FILE = process.env.DB_FILE || 'data/kumchop.db';

function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDirExists(DB_FILE);

const db = new Database(DB_FILE);

// Migrations: simple orders table
db.exec(`
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
`);

export function insertOrder(order: OrderSubmission) {
  const stmt = db.prepare(`INSERT INTO orders (id, created_at, name, phone, email, order_type, address, time, notes, subtotal_kobo, delivery_fee_kobo, total_kobo, raw_json, status)
    VALUES (@id, @createdAt, @name, @phone, @email, @orderType, @address, @time, @notes, @subtotalKobo, @deliveryFeeKobo, @totalKobo, @raw, @status)`);
  const info = stmt.run({
    id: order.id,
    createdAt: order.createdAt,
    name: order.name,
    phone: order.phone,
    email: order.email || null,
    orderType: order.orderType,
    address: order.address || null,
    time: order.time || null,
    notes: order.notes || null,
    subtotalKobo: order.subtotalKobo,
    deliveryFeeKobo: order.deliveryFeeKobo,
    totalKobo: order.totalKobo,
    raw: JSON.stringify(order),
    status: 'received',
  });
  return info;
}

export function listOrders(limit = 50, offset = 0) {
  const stmt = db.prepare('SELECT id, created_at as createdAt, name, phone, subtotal_kobo as subtotalKobo, total_kobo as totalKobo, status, raw_json as rawJson FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?');
  return stmt.all(limit, offset).map((r: any) => ({ ...r, raw: JSON.parse(r.rawJson) }));
}

export function getOrder(id: string) {
  const stmt = db.prepare('SELECT * FROM orders WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return { ...row, raw: JSON.parse(row.raw_json) };
}

export function updateOrderStatus(id: string, status: string) {
  const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const info = stmt.run(status, id);
  return info.changes > 0;
}
