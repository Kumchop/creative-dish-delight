import {describe,it,expect} from 'vitest';
import {cartTotal,readCart,canSubmitOrder,restaurant} from '@/lib/menu';
describe('Kumchop cart rules',()=>{
 it('restores persisted selections with quantities',()=>{expect(readCart(JSON.stringify([{id:'rice',quantity:2}]))).toEqual([{id:'rice',quantity:2}]);});
 it('calculates subtotal from item quantities',()=>{expect(cartTotal([{id:'rice',quantity:2},{id:'drinks',quantity:1}])).toBe(10500);expect(cartTotal([])).toBe(0);});
 it('rejects invalid local cart records',()=>{expect(readCart('[{"id":"rice","quantity":-1},{"id":"unknown","quantity":2},{"id":"rice","quantity":1.5}]')).toEqual([]);expect(readCart('bad data')).toEqual([]);});
 it('blocks sample orders until genuine details are supplied',()=>{expect(canSubmitOrder([{id:'rice',quantity:1}])).toBe(false);expect(canSubmitOrder([])).toBe(false);});
 it('does not invent a phone number or hours',()=>{expect(restaurant.phone).toBe(null);expect(restaurant.whatsapp).toBe(null);expect(restaurant.hours).toBe(null);});
});