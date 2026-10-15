import {createFileRoute} from '@tanstack/react-router';
import {MenuCatalog, validateCatalogSearch} from '@/components/restaurant/catalog';
import {pageHead} from '@/lib/menu';
import heroUrl from '@/assets/kumchop-interior.jpg?url';

export const Route = createFileRoute('/menu')({
  validateSearch: validateCatalogSearch,
  head: () => pageHead('Our Menu', 'The full Kumchop menu with naira prices: African dishes, rice, swallow, soup, sides and drinks.'),
});

function MenuPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <>
      {/* Hero image at the top of the menu page */}
      <section
        className="menu-hero"
        style={{
          backgroundImage: `url(${heroUrl ?? '/kumchop-interior.jpg'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '48vh',
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label="Inside Kumchop: warm lighting, comfortable seating and welcoming dining tables"
      />

      <div className="site-container page-top">
        <span className="eyebrow">SOMETHING FOR EVERY MOOD</span>
        <h1>
          Find Your <em>Flavour.</em>
        </h1>
        <p>
          Every dish, snack and drink at Kumchop, with current prices and easy ordering.
        </p>

        <MenuCatalog
          search={search}
          onSearch={(s) => navigate({ search: (prev) => ({ ...prev, ...s }), replace: true })}
        />
      </div>
    </>
  );
}

export default MenuPage;
