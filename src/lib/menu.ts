import rice from '@/assets/rice.jpg';
import shawarma from '@/assets/shawarma.jpg';
import pasta from '@/assets/pasta.jpg';
import grill from '@/assets/grill.jpg';
import dessert from '@/assets/dessert.jpg';
import drinks from '@/assets/drinks.jpg';
import swallow from '@/assets/swallow.jpg';
import soup from '@/assets/soup.jpg';
import icecream from '@/assets/icecream.jpg';
import fruits from '@/assets/fruits.jpg';
import {menuRecords} from './menu-data';

/* ---------- Editable business settings ---------- */
export const restaurant = {
  name: 'Kumchop',
  // Numbers as listed on kumchop.com.ng. Their purposes are not yet confirmed.
  phones: ['+234 806 773 0012', '+234 813 486 7350', '+234 906 142 3807'],
  // The number WhatsApp orders are sent to. Change here once confirmed.
  primaryOrderingNumber: '+234 806 773 0012' as string | null,
  email: 'support@kumchop.com.ng',
  address: 'Medoline Street, opposite Bovas Filling Station, Akungba Akoko, Ondo State, Nigeria',
  hours: [
    {days: 'Monday – Saturday', time: '8:00 AM – 10:00 PM'},
    {days: 'Sunday', time: '10:00 AM – 10:00 PM'},
  ],
  // Delivery fee in kobo. null = not configured; the restaurant confirms it on WhatsApp.
  deliveryFeeKobo: null as number | null,
  // Online card payment (Paystack/Flutterwave) needs merchant keys on the server.
  onlinePaymentEnabled: false,
};

/* ---------- Categories ---------- */
export const categories = [
  {id: 'african-dish', name: 'African Dishes', description: 'Home-style plates with real heart.', image: swallow},
  {id: 'rice', name: 'Rice', description: 'Jollof, fried, coconut and village rice.', image: rice},
  {id: 'swallow', name: 'Swallow', description: 'Pounded yam, amala, wheat and more.', image: swallow},
  {id: 'soup', name: 'Soup', description: 'Pepper soup, ogbono, edikaikong.', image: soup},
  {id: 'protein', name: 'Protein', description: 'Beef, goat, turkey, chicken and fish.', image: grill},
  {id: 'drinks', name: 'Drinks', description: 'Cold, fizzy and refreshing.', image: drinks},
  {id: 'ice-cream', name: 'Ice Cream', description: 'Ice cream, shakes and parfait.', image: icecream},
  {id: 'snacks', name: 'Snacks', description: 'Shawarma, pies, rolls and small chops.', image: shawarma},
  {id: 'combo', name: 'Combos', description: 'Ready-made favourites together.', image: rice},
  {id: 'fruits-and-vegetables', name: 'Fruits & Vegetables', description: 'Fresh salads and coleslaw.', image: fruits},
];

export type MenuItemRecord = {id: string; name: string; category: string; categories: string[]; priceKobo: number; soldOut: boolean; reviewNote?: string};
export type MenuItem = MenuItemRecord & {image: string};

const imageFor = (r: MenuItemRecord) => {
  const n = r.name.toLowerCase();
  if (n.includes('sharwama') || n.includes('shawarma')) return shawarma;
  if (n.includes('spag')) return pasta;
  if (/pie|roll|doughnut|cupcake|bread|small chop/.test(n)) return dessert;
  if (n.includes('yam and sauce') || n.includes('porridge') || n.includes('beans')) return swallow;
  return categories.find(c => c.id === r.category)?.image ?? rice;
};
export const menuItems: MenuItem[] = menuRecords.map(r => ({...r, image: imageFor(r)}));
export const findItem = (id: string) => menuItems.find(i => i.id === id);

/* ---------- Money (integer kobo) ---------- */
export const money = (kobo: number) =>
  '₦' + new Intl.NumberFormat('en-NG', {maximumFractionDigits: 0}).format(Math.round(kobo) / 100);

/* ---------- Cart ---------- */
export type CartLine = {id: string; quantity: number};
export const MAX_QTY = 50;
export const lineTotal = (line: CartLine) => (findItem(line.id)?.priceKobo ?? 0) * line.quantity;
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((t, l) => t + lineTotal(l), 0);
export const cartTotal = cartSubtotal;
export const deliveryFee = (orderType: 'pickup' | 'delivery') =>
  orderType === 'delivery' ? restaurant.deliveryFeeKobo : 0;
export const orderTotal = (lines: CartLine[], orderType: 'pickup' | 'delivery') =>
  cartSubtotal(lines) + (deliveryFee(orderType) ?? 0);
export const cartCount = (lines: CartLine[]) => lines.reduce((t, l) => t + l.quantity, 0);
export const canAdd = (id: string) => {
  const item = findItem(id);
  return Boolean(item && !item.soldOut);
};
export function readCart(raw: string | null): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is CartLine => typeof l === 'object' && l !== null && canAdd((l as CartLine).id) && Number.isInteger((l as CartLine).quantity) && (l as CartLine).quantity > 0)
      .map(l => ({id: l.id, quantity: Math.min(l.quantity, MAX_QTY)}));
  } catch {
    return [];
  }
}

/* ---------- WhatsApp order ---------- */
export type OrderDetails = {name: string; phone: string; email?: string; orderType: 'pickup' | 'delivery'; address?: string; time?: string; notes?: string};
export const whatsappDigits = (n: string) => {
  let d = n.replace(/\D/g, '');
  if (d.startsWith('0')) d = '234' + d.slice(1);
  return d;
};
export function buildWhatsAppMessage(lines: CartLine[], o: OrderDetails) {
  const fee = deliveryFee(o.orderType);
  const rows = lines.map(l => {
    const it = findItem(l.id)!;
    return `• ${l.quantity} × ${it.name} @ ${money(it.priceKobo)} = ${money(lineTotal(l))}`;
  });
  return [
    '*KUMCHOP — New order request*',
    '',
    `Name: ${o.name}`,
    `Phone: ${o.phone}`,
    o.email ? `Email: ${o.email}` : null,
    `Order type: ${o.orderType === 'delivery' ? 'Delivery' : 'Pickup'}`,
    o.orderType === 'delivery' && o.address ? `Delivery address: ${o.address}` : null,
    o.time ? `Preferred time: ${o.time}` : null,
    '',
    '*Items*',
    ...rows,
    '',
    `Subtotal: ${money(cartSubtotal(lines))}`,
    o.orderType === 'delivery' ? `Delivery fee: ${fee === null ? 'to be confirmed by Kumchop' : money(fee)}` : null,
    `Total: ${money(orderTotal(lines, o.orderType))}${o.orderType === 'delivery' && fee === null ? ' + delivery fee' : ''}`,
    o.notes ? `\nNotes: ${o.notes}` : null,
    '',
    'Please confirm my order. Thank you!',
  ].filter(x => x !== null).join('\n');
}
export function whatsappUrl(lines: CartLine[], o: OrderDetails) {
  if (!restaurant.primaryOrderingNumber) return null;
  return `https://wa.me/${whatsappDigits(restaurant.primaryOrderingNumber)}?text=${encodeURIComponent(buildWhatsAppMessage(lines, o))}`;
}
export const canSubmitOrder = (lines: CartLine[]) =>
  Boolean(restaurant.primaryOrderingNumber) && lines.length > 0 && lines.every(l => canAdd(l.id));

export const pageHead = (title: string, description: string) => ({meta: [{title: `${title} | Kumchop`}, {name: 'description', content: description}, {property: 'og:title', content: `${title} | Kumchop`}, {property: 'og:description', content: description}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}]});
