import {describe, it, expect} from 'vitest';
import {cartSubtotal, orderTotal, readCart, canAdd, money, buildWhatsAppMessage, whatsappUrl, menuItems, findItem} from '@/lib/menu';
import {filterMenu} from '@/components/restaurant/catalog';

describe('Kumchop menu and cart rules', () => {
  it('imports the real menu with naira prices', () => {
    expect(menuItems.length).toBe(79);
    expect(findItem('coke')?.priceKobo).toBe(80000);
    expect(money(80000)).toBe('₦800');
  });
  it('calculates subtotal from prices and quantities in kobo', () => {
    expect(cartSubtotal([{id: 'coke', quantity: 2}, {id: 'asun-spag', quantity: 1}])).toBe(760000);
    expect(cartSubtotal([])).toBe(0);
  });
  it('pickup total equals subtotal; unconfigured delivery fee adds nothing', () => {
    const l = [{id: 'coke', quantity: 3}];
    expect(orderTotal(l, 'pickup')).toBe(240000);
    expect(orderTotal(l, 'delivery')).toBe(240000);
  });
  it('blocks sold-out items', () => {
    expect(canAdd('5-alive')).toBe(false);
    expect(readCart(JSON.stringify([{id: '5-alive', quantity: 1}, {id: 'coke', quantity: 2}]))).toEqual([{id: 'coke', quantity: 2}]);
  });
  it('rejects invalid stored cart data', () => {
    expect(readCart('[{"id":"coke","quantity":-1},{"id":"x","quantity":2}]')).toEqual([]);
    expect(readCart('bad')).toEqual([]);
  });
  it('filters by category and search, sorts by price', () => {
    const r = filterMenu(menuItems, 'drinks', 'coke', 'name', false);
    expect(r.map(i => i.id)).toEqual(['coke']);
    const p = filterMenu(menuItems, 'rice', '', 'price-asc', false);
    expect(p[0].priceKobo).toBeLessThanOrEqual(p[p.length - 1].priceKobo);
  });
  it('builds an encoded WhatsApp order to the primary number', () => {
    const o = {name: 'Ada', phone: '08030000000', orderType: 'delivery' as const, address: 'Ibaka road'};
    const msg = buildWhatsAppMessage([{id: 'coke', quantity: 2}], o);
    expect(msg).toContain('2 × Coke @ ₦800 = ₦1,600');
    expect(msg).toContain('Delivery address: Ibaka road');
    expect(whatsappUrl([{id: 'coke', quantity: 2}], o)).toMatch(/^https:\/\/wa\.me\/2348067730012\?text=/);
  });
});
