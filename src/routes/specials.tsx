import {createFileRoute,Link} from '@tanstack/react-router';
import {ArrowUpRight,Utensils} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {SpecialsBanner} from '@/components/restaurant/sections';
import {pageHead} from '@/lib/menu';
export const Route=createFileRoute('/specials')({head:()=>pageHead('Specials & Good Things','Discover the latest confirmed specials and combinations at Kumchop, Akungba. New offers will appear here when announced.'),component:Specials});
function Specials(){return <><div className="site-container page-top"><span className="eyebrow">MORE REASONS TO SMILE</span><h1>A Little <em>Something Special.</em></h1><p>Good things are worth looking forward to.</p></div><SpecialsBanner/><div className="site-container section"><div className="empty-state"><Utensils size={34}/><h2>Something delicious is on the way.</h2><p>No specials have been announced yet.<br/>In the meantime, explore our food categories.</p><Button asChild><Link to="/menu">Explore Our Menu <ArrowUpRight/></Link></Button></div></div></>}