// Admin order detail page for TanStack Start routing
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { pageHead, money } from '@/lib/menu';

export const Route = createFileRoute('/admin/$id')({
  head: ({ params }: any) => pageHead(`Order ${params.id}`, `Admin view for order ${params.id}`),
  component: OrderDetail,
});

function getAuthHeader() {
  const raw = typeof window !== 'undefined' ? sessionStorage.getItem('kumchop_admin_auth') : null;
  return raw ? { Authorization: raw } : {};
}

export default function OrderDetail() {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // derive id from location as a fallback when route params are not provided
  const id = typeof window !== 'undefined' ? window.location.pathname.split('/').at(-1) : undefined;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = getAuthHeader();
        const res = await fetch(`/api/admin/orders/${id}`, { headers });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            sessionStorage.removeItem('kumchop_admin_auth');
            window.location.href = '/admin';
            return;
          }
          setError('Could not fetch order');
          setOrder(null);
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        setOrder(j.order ?? null);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch order');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
    return () => { cancelled = true; };
  }, [id]);

  if (!id) return <div className="site-container page-body">Missing order id</div>;

  async function updateStatus(status: string) {
    setLoading(true);
    try {
      const headers = { ...getAuthHeader(), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/admin/orders/${id}/status`, { method: 'POST', headers, body: JSON.stringify({ status }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message || 'Failed to update status');
        return;
      }
      // refresh
      const j = await res.json();
      setOrder((o:any) => ({ ...o, status }));
    } catch (err) {
      console.error(err);
      setError('Failed to update status');
    } finally {
      setLoading(false);
    }
  }

  async function resendNotifications() {
    setLoading(true);
    setError(null);
    try {
      const headers = { ...getAuthHeader(), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/admin/orders/${id}/resend`, { method: 'POST', headers });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message || 'Failed to resend notifications');
        return;
      }
      const j = await res.json();
      if (j.notified) {
        // show ephemeral success
        alert('Notification attempt sent');
      } else {
        alert('Notification attempt made but no channel configured');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to resend');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="site-container page-body">
      <div className="page-top"><h1>Order details</h1><div className="actions"><Button variant="outline" onClick={() => window.location.href = '/admin'}>Back</Button></div></div>
      {loading && <p>Loading…</p>}
      {error && <div className="field-error">{error}</div>}
      {!loading && order && (
        <div>
          <h2>{order.name} · {order.phone}</h2>
          <p>When: {new Date(order.createdAt).toLocaleString()}</p>
          <p>Type: {order.orderType}</p>
          {order.address && <p>Address: {order.address}</p>}
          <h3>Items</h3>
          <ul>
            {(order.raw?.lines ?? order.lines ?? []).map((l:any) => (
              <li key={l.id}>{l.quantity} × {l.name} — {money(l.priceKobo ?? l.priceKobo)}</li>
            ))}
          </ul>
          <p>Subtotal: {money(order.raw?.subtotalKobo ?? order.subtotalKobo ?? 0)}</p>
          <p>Total: {money(order.raw?.totalKobo ?? order.totalKobo ?? 0)}</p>
          <p>Status: {order.status}</p>

          <div className="mt-4">
            <Button onClick={() => updateStatus('confirmed')} className="mr-2">Mark Confirmed</Button>
            <Button onClick={() => updateStatus('preparing')} className="mr-2">Mark Preparing</Button>
            <Button onClick={() => updateStatus('completed')} variant="ghost">Mark Completed</Button>
          </div>

          <div className="mt-4">
            <Button onClick={resendNotifications}>Re-send notification</Button>
          </div>
        </div>
      )}
    </section>
  );
}
