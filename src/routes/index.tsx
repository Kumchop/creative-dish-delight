import { createFileRoute,Link } from '@tanstack/react-router';
import {ArrowUpRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Highlights,Favourites,StorySection,SpecialsBanner,GalleryPreview,Reviews,StoryButton} from '@/components/restaurant/sections';
import {pageHead} from '@/lib/menu';
import feast from '@/assets/kumchop-feast.jpg';
export const Route=createFileRoute('/')({head:()=>pageHead('Every Taste Feels Good','Discover Kumchop in Akungba Akoko. Delicious meals, snacks, shawarma, grills, desserts and drinks for every craving.'),component:Index});
function Index(){return <><section className="hero"><img className="hero-image" src={feast} width={1920} height={1024} alt="A delicious illustrative feast of jollof rice, grilled chicken, golden plantain and a refreshing drink" fetchPriority="high"/><div className="site-container hero-content"><div className="hero-copy"><span className="eyebrow">GOOD FOOD. GREAT MOMENTS.</span><h1>Delicious Meals<br/><em>For Every Craving.</em></h1><p className="hero-description">From hearty meals to tasty snacks, flavourful shawarma, sweet treats and refreshing drinks — Kumchop has something for everyone.</p><div className="hero-buttons"><Button asChild size="lg"><Link to="/menu">Explore Our Menu <ArrowUpRight/></Link></Button><StoryButton/></div></div></div><span className="hero-note">Real Food. Real Flavour.</span></section><Highlights/><Favourites/><StorySection/><SpecialsBanner/><GalleryPreview/><Reviews/></>}
