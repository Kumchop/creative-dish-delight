import {createFileRoute, Link} from '@tanstack/react-router';
import {useState, type FormEvent} from 'react';
import {MessageCircle, ArrowLeft, CreditCard} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useCart} from '@/components/restaurant/cart';
import {findItem, lineTotal, cartSubtotal, orderTotal, deliveryFee, money, restaurant, whatsappUrl, canSubmitOrder, pageHead, type OrderDetails} from '@/lib/menu';
export const Route = createFileRoute('/checkout')({head: () => pageHead('Checkout', 'Enter your details and send your Kumchop order on WhatsApp for confirmation.'), component: Checkout});

export function validateOrder(o: OrderDetails) {
  const e: Record<string, string> = {};
  if (o.name.trim().length < 2) e.name = 'Please enter your full name.';
  if (!/^\+?[0-9 ()-]{7,20}$/.test(o.phone.trim()) || o.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number, e.g. 0803 000 0000.';
  if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) e.email = 'Enter a valid email or leave it blank.';
  if (o.orderType === 'delivery' && (o.address ?? '').trim().length < 8) e.address = 'Enter your delivery address with a landmark.';
  return e;
}

function Checkout() {
  const {lines} = useCart();
  const [type, setType] = useState<'pickup' | 'delivery'>('pickup');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sentAt, setSentAt] = useState<number | null>(null);
  const fee = deliveryFee(type);
  const submit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (sentAt && Date.now() - sentAt < 5000) return;
    const f = new FormData(ev.currentTarget); const g = (k: string) => String(f.get(k) ?? '').trim();
    const o: OrderDetails = {name: g('name'), phone: g('phone'), email: g('email') || undefined, orderType: type, address: g('address') || undefined, time: g('time') || undefined, notes: g('notes') || undefined};
    const e = validateOrder(o); setErrors(e); if (Object.keys(e).length) return;
    const url = whatsappUrl(lines, o); if (!url) return;
    setSentAt(Date.now()); window.open(url, '_blank', 'noopener');
  };
  const err = (k: string) => errors[k] && <span className="field-error" role="alert">{errors[k]}</span>;
  return <><div className="site-container page-top"><span className="eyebrow">ONE LAST STEP</span><h1>Checkout.</h1></div>
    <section className="site-container page-body">{lines.length === 0 ? <div className="empty-state"><h2>Your cart is empty.</h2><Button asChild className="mt-6"><Link to="/order">Order Online</Link></Button></div> :
      <div className="cart-layout"><div>
        <form className="form-grid" noValidate onSubmit={submit}>
          <label>Full name *<input name="name" autoComplete="name" placeholder="Full name" aria-invalid={!!errors.name} />{err('name')}</label>
          <label>Phone number *<input type="tel" name="phone" autoComplete="tel" placeholder="0803 000 0000" aria-invalid={!!errors.phone} />{err('phone')}</label>
          <label className="form-wide">Email (optional)<input type="email" name="email" autoComplete="email" placeholder="you@example.com" />{err('email')}</label>
          <fieldset className="form-wide order-type"><legend>Order type *</legend>
            {(['pickup', 'delivery'] as const).map(t => <label key={t} className={type === t ? 'active' : ''}><input type="radio" name="orderType" value={t} checked={type === t} onChange={() => setType(t)} />{t === 'pickup' ? 'Pickup' : 'Delivery'}</label>)}
          </fieldset>
          {type === 'delivery' && <label className="form-wide">Delivery address *<textarea name="address" autoComplete="street-address" placeholder="Address and nearby landmark" aria-invalid={!!errors.address} />{err('address')}</label>}
          <label className="form-wide">Preferred {type} time (optional)<input name="time" placeholder="e.g. Today, 7:30 PM" /></label>
          <label className="form-wide">Order notes (optional)<textarea name="notes" placeholder="Allergies, extra pepper, etc." /></label>
          <div className="form-wide">
            <Button type="submit" size="lg" disabled={!canSubmitOrder(lines)} className="w-full"><MessageCircle />Send order on WhatsApp</Button>
            <p className="fine-print">Your order is sent to Kumchop ({restaurant.primaryOrderingNumber}) on WhatsApp. It is only confirmed once Kumchop replies.</p>
            {sentAt && <p role="status" className="form-feedback">WhatsApp opened with your order. Tap send in WhatsApp, then wait for Kumchop to confirm. Not opened? Allow pop-ups and try again.</p>}
            <div className="notice mt-5"><CreditCard size={16} className="inline mr-2" /><strong>Card payment is not available yet.</strong> Pay as agreed with Kumchop when they confirm your order.</div>
          </div>
        </form>
        <Button variant="link" asChild className="mt-5"><Link to="/cart"><ArrowLeft />Back to cart</Link></Button></div>
        <aside className="cart-summary"><h3>Order summary</h3>{lines.map(l => { const it = findItem(l.id); return it ? <div key={l.id} className="summary-row"><span>{l.quantity} × {it.name}</span><span>{money(lineTotal(l))}</span></div> : null; })}
          <div className="summary-row"><span>Subtotal</span><span>{money(cartSubtotal(lines))}</span></div>
          {type === 'delivery' && <div className="summary-row"><span>Delivery fee</span><span>{fee === null ? 'To be confirmed' : money(fee)}</span></div>}
          <div className="summary-row summary-total"><span>Total</span><span>{money(orderTotal(lines, type))}{type === 'delivery' && fee === null ? ' + delivery' : ''}</span></div></aside>
      </div>}</section></>;
}
