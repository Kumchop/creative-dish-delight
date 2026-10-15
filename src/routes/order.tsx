import {createFileRoute} from '@tanstack/react-router';
import {MenuCatalog, validateCatalogSearch} from '@/components/restaurant/catalog';
import {pageHead} from '@/lib/menu';
export const Route = createFileRoute('/order')({validateSearch: validateCatalogSearch, head: () => pageHead('Order Online', 'Order Kumchop rice, swallow, soups, proteins, snacks, drinks and ice cream online in Akungba Akoko. Send your order to Kumchop on WhatsApp.'), component: OrderPage});
function OrderPage() {
  const search = Route.useSearch(); const navigate = Route.useNavigate();
  return <><div className="site-container page-top"><span className="eyebrow">ORDER ONLINE</span><h1>Order Your <em>Favourites.</em></h1><p>Fresh meals, tasty snacks and delightful treats, made for your cravings.</p></div>
    <MenuCatalog search={search} onSearch={s => navigate({search: prev => ({...prev, ...s}), replace: true})} /></>;
}
