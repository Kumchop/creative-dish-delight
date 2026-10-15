import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {Search, Plus, Minus, SearchX, ShoppingBag, ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {categories, menuItems, money, cartSubtotal, type MenuItem} from '@/lib/menu';
import {useCart} from './cart';

export type SortKey = 'name' | 'price-asc' | 'price-desc';
export type CatalogSearch = {category: string; sort: SortKey};
export const validateCatalogSearch = (s: Record<string, unknown>): CatalogSearch => ({
  category: typeof s['category'] === 'string' && categories.some(c => c.id === s['category']) ? (s['category'] as string) : 'all',
  sort: s['sort'] === 'price-asc' || s['sort'] === 'price-desc' ? s['sort'] : 'name',
});

export function filterMenu(items: MenuItem[], category: string, query: string, sort: SortKey, availableOnly: boolean) {
  const q = query.toLowerCase().trim();
  const out = items.filter(i => (category === 'all' || i.categories.includes(category)) && (!q || i.name.toLowerCase().includes(q)) && (!availableOnly || !i.soldOut));
  return out.sort((a, b) => sort === 'price-asc' ? a.priceKobo - b.priceKobo : sort === 'price-desc' ? b.priceKobo - a.priceKobo : a.name.localeCompare(b.name));
}

export function MenuCatalog({search, onSearch}: {search: CatalogSearch; onSearch: (s: Partial<CatalogSearch>) => void}) {
  const [query, setQuery] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const {lines, change, count, setDrawerOpen} = useCart();
  const items = filterMenu(menuItems, search.category, query, search.sort, availableOnly);
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;
  return (
    <section className="site-container page-body">
      <div className="order-toolbar">
        <div className="search-field"><Search /><input type="search" aria-label="Search food by name" placeholder="Search food by name…" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <div className="order-toolbar-row">
          <label className="sort-select">Sort
            <select aria-label="Sort products" value={search.sort} onChange={e => onSearch({sort: e.target.value as SortKey})}>
              <option value="name">Name (A–Z)</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
            </select>
          </label>
          <label className="avail-toggle"><input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} />Available only</label>
          <Button variant="outline" onClick={() => setDrawerOpen(true)} aria-label={`Open cart, ${count} items`}><ShoppingBag />{count} {count === 1 ? 'item' : 'items'} · {money(cartSubtotal(lines))}</Button>
        </div>
      </div>
      <div className="menu-controls order-cats" aria-label="Menu categories">
        {[{id: 'all', name: 'All'}, ...categories].map(c => <Button size="sm" variant={search.category === c.id ? 'default' : 'outline'} key={c.id} aria-pressed={search.category === c.id} onClick={() => onSearch({category: c.id})}>{c.name}</Button>)}
      </div>
      <p className="fine-print mb-5" aria-live="polite">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
      <div className="food-grid">
        {items.map(item => {
          const qty = lines.find(l => l.id === item.id)?.quantity ?? 0;
          return (
            <article className={`food-card ${item.soldOut ? 'is-sold-out' : ''}`} key={item.id}>
              <div className="food-photo"><img src={item.image} width={400} height={400} alt={item.name} loading="lazy" />{item.soldOut && <span className="sold-badge">Sold out</span>}</div>
              <div className="food-body">
                <span className="food-cat">{catName(item.category)}</span>
                <h3>{item.name}</h3>
                <span className={`food-status ${item.soldOut ? 'out' : 'in'}`}>{item.soldOut ? 'Currently unavailable' : 'Available'}</span>
                <div className="food-bottom">
                  <strong>{money(item.priceKobo)}</strong>
                  {item.soldOut ? <Button size="sm" variant="outline" disabled>Sold out</Button>
                    : qty === 0 ? <Button size="sm" onClick={() => change(item.id, 1)} aria-label={`Add ${item.name} to cart`}><Plus />Add</Button>
                    : <div className="quantity compact"><Button size="icon" variant="outline" onClick={() => change(item.id, -1)} aria-label={`Decrease ${item.name}`}><Minus /></Button><span aria-label={`${item.name} quantity`}>{qty}</span><Button size="icon" variant="outline" onClick={() => change(item.id, 1)} aria-label={`Increase ${item.name}`}><Plus /></Button></div>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {items.length === 0 && <div className="empty-state"><SearchX size={34} /><h2>Nothing matches that search</h2><Button variant="outline" onClick={() => { setQuery(''); setAvailableOnly(false); onSearch({category: 'all'}); }}>Reset filters</Button></div>}
      {count > 0 && <div className="sticky-cart"><Button size="lg" asChild><Link to="/cart"><ShoppingBag />View cart · {money(cartSubtotal(lines))}<ArrowRight /></Link></Button></div>}
    </section>
  );
}
