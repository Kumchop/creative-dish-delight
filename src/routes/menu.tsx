import {createFileRoute} from '@tanstack/react-router';
import {MenuCatalog, validateCatalogSearch} from '@/components/restaurant/catalog';
import {pageHead} from '@/lib/menu';
export const Route = createFileRoute('/menu')({validateSearch: validateCatalogSearch, head: () => pageHead('Our Menu', 'The full Kumchop menu with naira prices: African dishes, rice, swallow, soup, protein, drinks, ice cream, snacks, combos and fruits.'), component: MenuPage});
function MenuPage() {
  const search = Route.useSearch(); const navigate = Route.useNavigate();
  return <><div className="site-container page-top"><span className="eyebrow">SOMETHING FOR EVERY MOOD</span><h1>Find Your <em>Flavour.</em></h1><p>Every dish, snack and drink at Kumchop, with current prices and availability.</p></div>
    <MenuCatalog search={search} onSearch={s => navigate({search: prev => ({...prev, ...s}), replace: true})} /></>;
}
