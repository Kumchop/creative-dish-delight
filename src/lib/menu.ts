import rice from '@/assets/rice.jpg';
import shawarma from '@/assets/shawarma.jpg';
import pasta from '@/assets/pasta.jpg';
import grill from '@/assets/grill.jpg';
import dessert from '@/assets/dessert.jpg';
import drinks from '@/assets/drinks.jpg';
export const categories = [
 {id:'rice',name:'Rice & Meals',description:'Hearty plates. Happy hearts.',image:rice},
 {id:'shawarma',name:'Shawarma & Snacks',description:'Little bites, big flavour.',image:shawarma},
 {id:'pasta',name:'Pasta & Specials',description:'A delicious twist on the everyday.',image:pasta},
 {id:'grill',name:'Proteins & Grill',description:'Grilled to satisfy your cravings.',image:grill},
 {id:'dessert',name:'Desserts',description:'Save a little room for sweetness.',image:dessert},
 {id:'drinks',name:'Drinks',description:'A refreshing finish to every meal.',image:drinks},
];
export type MenuItem={id:string;name:string;description:string;category:string;price:number;image:string;sample:boolean};
export const menuItems:MenuItem[] = categories.map((c,i)=>({id:c.id,name:['Jollof & grilled chicken','Chicken shawarma','Tomato pasta','Grilled chicken wings','Chocolate cake','Hibiscus cooler'][i] ?? c.name,description:c.description,category:c.id,price:[4500,3000,3500,4000,2500,1500][i] ?? 0,image:c.image,sample:true}));
export const money=(value:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(value);
export type CartLine={id:string;quantity:number};
export const cartTotal=(lines:CartLine[])=>lines.reduce((total,line)=>total+(menuItems.find(item=>item.id===line.id)?.price ?? 0)*line.quantity,0);
export function readCart(raw:string|null):CartLine[]{try{const parsed:unknown=JSON.parse(raw ?? '[]'); if(!Array.isArray(parsed)) return []; return parsed.filter((line):line is CartLine=>typeof line==='object' && line!==null && menuItems.some(item=>item.id===line.id) && Number.isInteger(line.quantity) && line.quantity>0).map(line=>({id:line.id,quantity:line.quantity}));}catch{return [];}}
export const restaurant={phone:null,whatsapp:null,hours:null,orderingEnabled:false};
export const canSubmitOrder=(lines:CartLine[])=>restaurant.orderingEnabled && Boolean(restaurant.whatsapp) && lines.length>0 && lines.every(line=>menuItems.find(item=>item.id===line.id)?.sample===false);
export const pageHead=(title:string,description:string)=>({meta:[{title:`${title} | Kumchop`},{name:'description',content:description},{property:'og:title',content:`${title} | Kumchop`},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]});
