import {Link,useLocation} from '@tanstack/react-router';
import {useEffect,useState,type ReactNode} from 'react';
import {Search,ShoppingBag,Menu,X,ArrowUpRight,MapPin} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {CartProvider,useCart} from './cart';
import {CartDrawer} from './cart-drawer';
import {restaurant} from '@/lib/menu';
import logo from '@/assets/kumchop-logo.png.asset.json';

const links=[{to:'/',label:'Home'},{to:'/menu',label:'Menu'},{to:'/order',label:'Order Online'},{to:'/about',label:'About'},{to:'/specials',label:'Specials'},{to:'/gallery',label:'Gallery'},{to:'/contact',label:'Contact'}];

function Header(){
  const {count,setDrawerOpen}=useCart();
  const [open,setOpen]=useState(false);
  const [scrolled,setScrolled]=useState(false);
  const location=useLocation();
  useEffect(()=>{setOpen(false);},[location.pathname]);
  useEffect(()=>{const onScroll=()=>setScrolled(window.scrollY>8);onScroll();window.addEventListener('scroll',onScroll);return ()=>window.removeEventListener('scroll',onScroll);},[]);
  return <header className={scrolled ? 'site-header scrolled' : 'site-header'}>
    <div className="site-container header-inner">
      <Link to="/" className="brand-mark" aria-label="Kumchop home">
        <img src="/kumchop-logo.png" alt="Kumchop" style={{height: 42, width: 'auto'}} onError={(e) => { (e.currentTarget as HTMLImageElement).src = logo.url; }} />
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map((link)=> <Link key={link.to} to={link.to} className={location.pathname===link.to ? 'active' : undefined}>{link.label}</Link>)}
      </nav>
      <div className="header-actions">
        <button className="icon-button" aria-label="Search"><Search size={18} /></button>
        <button className="cart-button" aria-label="Open cart" onClick={()=>setDrawerOpen(true)}>
          <ShoppingBag size={18} />
          {count>0 && <span className="cart-count">{count}</span>}
        </button>
        <Link to="/order" className="primary-button">Order Now <ArrowUpRight size={16} /></Link>
      </div>
      <button className="menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} onClick={()=>setOpen(v=>!v)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
    </div>
    {open && <div className="mobile-nav"><nav>{links.map((link)=><Link key={link.to} to={link.to} className={location.pathname===link.to ? 'active' : undefined}>{link.label}</Link>)}</nav></div>}
  </header>;
}

function Footer(){
  return <footer className="site-footer"><div className="site-container footer-grid"><div className="footer-brand"><Link to="/"><img src="/kumchop-logo.png" alt="Kumchop logo" style={{height: 42, width: 'auto'}} onError={(e) => { (e.currentTarget as HTMLImageElement).src = logo.url; }} /></Link><p>Warm meals, good vibes and unforgettable flavours.</p></div><div className="footer-column"><h3>Visit</h3><p>{restaurant.location}</p><p>Open daily</p></div><div className="footer-column"><h3>Contact</h3><p>{restaurant.phone}</p><p>{restaurant.email}</p></div><div className="footer-column"><h3>Explore</h3><Link to="/menu">Menu</Link><Link to="/order">Order Online</Link><Link to="/gallery">Gallery</Link></div></div></footer>;
}

export function RestaurantShell({children}:{children:ReactNode}){return <CartProvider><a href="#main-content" className="skip-link">Skip to content</a><Header/><main id="main-content">{children}</main><CartDrawer/><Footer/></CartProvider>;
}
