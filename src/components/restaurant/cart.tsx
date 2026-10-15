import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {type CartLine,readCart,canAdd,cartCount,MAX_QTY} from '@/lib/menu';
type CartContextValue={lines:CartLine[];add:(id:string)=>void;change:(id:string,delta:number)=>void;remove:(id:string)=>void;clear:()=>void;count:number;drawerOpen:boolean;setDrawerOpen:(open:boolean)=>void};
const CartContext=createContext<CartContextValue|null>(null);
export function CartProvider({children}:{children:ReactNode}){
  const [lines,setLines]=useState<CartLine[]>([]);const [ready,setReady]=useState(false);const [drawerOpen,setDrawerOpen]=useState(false);
  useEffect(()=>{try{setLines(readCart(localStorage.getItem('kumchop-cart')));}catch{} setReady(true);},[]);
  useEffect(()=>{if(ready){try{localStorage.setItem('kumchop-cart',JSON.stringify(lines));}catch{}}},[lines,ready]);
  const change=(id:string,delta:number)=>setLines(previous=>{
    const found=previous.find(line=>line.id===id);
    if(!found)return delta>0&&canAdd(id)?[...previous,{id,quantity:Math.min(delta,MAX_QTY)}]:previous;
    return previous.map(line=>line.id===id?{...line,quantity:Math.min(line.quantity+delta,MAX_QTY)}:line).filter(line=>line.quantity>0);
  });
  return <CartContext.Provider value={{lines,add:id=>change(id,1),change,remove:id=>setLines(previous=>previous.filter(line=>line.id!==id)),clear:()=>setLines([]),count:cartCount(lines),drawerOpen,setDrawerOpen}}>{children}</CartContext.Provider>;
}
export function useCart(){const value=useContext(CartContext);if(!value)throw new Error('Cart provider is required');return value;}
