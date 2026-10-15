import {createFileRoute, Link} from '@tanstack/react-router';
import {ShoppingBag, ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useCart} from '@/components/restaurant/cart';
import {CartLines} from '@/components/restaurant/cart-drawer';
import {money, cartSubtotal, restaurant, pageHead} from '@/lib/menu';
export const Route = createFileRoute('/cart')({head: () => pageHead('Your Cart', 'Review your Kumchop order, update quantities and see your total before checkout.'), component: Cart});
function Cart() {
  const {lines, clear, count} = useCart();
  return <><div className="site-container page-top"><span className="eyebrow">A LITTLE OF WHAT YOU LOVE</span><h1>Your <em>Cart.</em></h1></div>
    <section className="site-container page-body">{lines.length === 0 ? <div className="empty-state"><ShoppingBag size={40} /><h2>Your next good meal starts here.</h2><p>Your cart is empty.</p><Button asChild><Link to="/order">Order Online <ArrowRight /></Link></Button></div> :
      <div className="cart-layout"><div><CartLines /><div className="flex flex-wrap gap-3 mt-5"><Button variant="link" asChild><Link to="/order">Continue shopping <ArrowRight /></Link></Button><Button variant="ghost" onClick={clear}>Clear cart</Button></div></div>
        <aside className="cart-summary"><h3>Order summary</h3><div className="summary-row"><span>Items</span><span>{count}</span></div><div className="summary-row"><span>Subtotal</span><span>{money(cartSubtotal(lines))}</span></div><div className="summary-row"><span>Delivery</span><span>{restaurant.deliveryFeeKobo === null ? 'Confirmed by Kumchop' : money(restaurant.deliveryFeeKobo)}</span></div><div className="summary-row summary-total"><span>Total</span><span>{money(cartSubtotal(lines))}</span></div><p className="fine-print">Pickup has no fee. For delivery, Kumchop confirms the fee when they reply.</p><Button asChild size="lg"><Link to="/checkout">Proceed to Checkout <ArrowRight /></Link></Button></aside></div>}</section></>;
}
