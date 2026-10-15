import {createFileRoute} from '@tanstack/react-router';
import {StorySection,Highlights,Reviews} from '@/components/restaurant/sections';
import {pageHead} from '@/lib/menu';
export const Route=createFileRoute('/about')({head:()=>pageHead('Our Story','Good food brings people together. Discover the spirit of Kumchop, your restaurant at Akungba Akoko.'),component:About});
function About(){return <><div className="site-container page-top"><span className="eyebrow">THIS IS KUMCHOP</span><h1>Good Food.<br/><em>Even Better Moments.</em></h1><p>Rooted in Akungba. Made for every craving.</p></div><StorySection full/><Highlights/><Reviews/></>}