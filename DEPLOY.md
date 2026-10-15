# Cloudflare deployment notes

## Required Cloudflare setup

1. Create a Cloudflare D1 database.
2. Bind it with the name `KUMCHOP`.
3. Add the following secrets in your Cloudflare Pages or Worker project settings:
   - `ADMIN_USER`
   - `ADMIN_PASS`
   - `WHATSAPP_CLOUD_TOKEN` (optional)
   - `WHATSAPP_PHONE_NUMBER_ID` (optional)
   - `WHATSAPP_TO_NUMBER` (optional)
   - `SLACK_WEBHOOK_URL` (optional)

## D1 schema

```sql
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
```

## Deploying with Cloudflare Pages

1. Connect the GitHub repo to Cloudflare Pages.
2. Set build command to `npm run build`.
3. Set output directory based on your Pages build output.
4. Add the D1 binding `KUMCHOP`.
5. Add secrets above.
6. Deploy.

## Smoke tests

```bash
curl -X POST https://<your-url>/api/orders \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"08030000000","orderType":"pickup","lines":[{"id":"kumchop-jollof-rice","quantity":1}]}'
```

```bash
curl -u "$ADMIN_USER:$ADMIN_PASS" "https://<your-url>/api/admin/orders?limit=20&offset=0"
```

```bash
curl -u "$ADMIN_USER:$ADMIN_PASS" -X POST "https://<your-url>/api/admin/orders/<orderId>/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}'
```

```bash
curl -u "$ADMIN_USER:$ADMIN_PASS" -X POST "https://<your-url>/api/admin/orders/<orderId>/resend"
```

## Notes

- The app is designed to run in a Cloudflare Worker/Pages runtime and uses the `KUMCHOP` D1 binding.
- It does not rely on local filesystem writes for runtime persistence.
- Notifications are best-effort and optional; the app still stores orders if notification services are unavailable.
