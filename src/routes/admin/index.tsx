import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { pageHead, money } from '@/lib/menu';

export const Route = createFileRoute('/admin')({
  head: () => pageHead('Admin: Orders', 'Admin view for Kumchop orders'),
  component: AdminIndex,
});

function getAuthHeader() {
  const raw = typeof window !== 'undefined' ? sessionStorage.getItem('kumchop_admin_auth') : null;
  return raw ? { Authorization: raw } : {};
}

function saveCredentials(user: string, pass: string) {
  try {
    const b = btoa(`${user}:${pass}`);
    sessionStorage.setItem('kumchop_admin_auth', `Basic ${b}`);
  } catch {}
}

function clearCredentials() {
  try {
    sessionStorage.removeItem('kumchop_admin_auth');
  } catch {}
}

function LoginPrompt({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    try {
      const b = btoa(`${user}:${pass}`);
      const res = await fetch('/api/admin/orders?limit=1', { headers: { Authorization: `Basic ${b}` } });
      if (!res.ok) {
        setError('Invalid credentials');
        return;
      }
      saveCredentials(user, pass);
      onSuccess();
    } catch (err) {
      setError('Login failed');
    }
  }

  return (
    <section className="site-container page-body">
      <h2>Admin login</h2>
      <form onSubmit={submit} className="form-grid">
        <label>Username<input value={user} onChange={e => setUser(e.target.value)} /></label>
        <label>Password<input type="password" value={pass} onChange={e => setPass(e.target.value)} /></label>
        {error && <div className="field-error">{error}</div>}
        <div>
          <Button type="submit">Sign in</Button>
        </div>
      </form>
    </section>
  );
}

export default function AdminIndex() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => Boolean(typeof window !== 'undefined' && sessionStorage.getItem('kumchop_admin_auth')));
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeader();
        const res = await fetch(`/api/admin/orders?limit=${limit}&offset=${page * limit}`, { headers });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            clearCredentials();
            setLoggedIn(false);
          }
          setOrders([]);
          setLoading(false);
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        setOrders(j.orders ?? []);
      } catch (err) {
        console.error(err);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
    return () => { cancelled = true; };
  }, [loggedIn, page]);

  if (!loggedIn) return <LoginPrompt onSuccess={() => setLoggedIn(true)} />;

  return (
    <section className="site-container page-body">
      <div className="page-top"><h1>Orders</h1><div className="actions"><Button variant="outline" onClick={() => { clearCredentials(); setLoggedIn(false); }}>Sign out</Button></div></div>
      <p className="fine-print">Showing recent orders. Click an order ID to view details.</p>
      {loading ? <p>Loading…</p> : (
        <table className="orders-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>When</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Subtotal</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td><Link to={`/admin/${o.id}`}>{o.id}</Link></td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
                <td>{o.name} · {o.phone}</td>
                <td>{(o.raw?.lines ?? []).map((l:any)=> `${l.quantity}×${l.name}`).join(', ')}</td>
                <td>{money(o.raw?.subtotalKobo ?? o.subtotalKobo ?? 0)}</td>
                <td>{money(o.raw?.totalKobo ?? o.totalKobo ?? 0)}</td>
                <td>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4">
        <Button variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
        <Button variant="outline" onClick={() => setPage(p => p + 1)} className="ml-2">Next</Button>
      </div>
    </section>
  );
}
