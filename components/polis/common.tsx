"use client";
import {Bookmark,BookmarkCheck,ChevronRight,Landmark,Newspaper,CalendarDays,Bus,TreePine,BookOpen,Building2,ArrowRight} from "lucide-react";
import {friends,questions,singular,type CivicItem,type View} from "@/lib/polis-data";
import type {DemoState} from "@/lib/polis-state";

export function Avatar({id,initials,color,size="normal"}:{id?:string;initials?:string;color?:string;size?:string}){
  const person=friends.find(f=>f.id===id);
  return <span className={"avatar "+(person?.color||color||"blue")+" "+size} aria-label={person?.name}>{person?.initials||initials||"R"}</span>;
}
export function AvatarStack({ids}:{ids:string[]}){return <span className="avatar-stack">{ids.slice(0,3).map(id=><Avatar key={id} id={id} size="small"/>)}</span>;}
export function Score({value,label,small=false}:{value:number;label?:string;small?:boolean}){return <span className={"score-group "+(small?"small":"")}><span className="score-number">{value.toFixed(1)}</span>{label&&<span className="score-label">{label}</span>}</span>;}
export function ItemIcon({item}:{item:CivicItem}){
  if(item.initials)return <Avatar initials={item.initials} color={item.color} size="large"/>;
  const Icon=item.kind==="News"?Newspaper:item.kind==="Events"?CalendarDays:item.topic==="Transportation"?Bus:item.topic==="Public spaces"?TreePine:item.topic==="Education"?BookOpen:Building2;
  return <span className={"item-icon "+(item.topic==="Public spaces"||item.topic==="Environment"?"green":item.topic==="Transportation"?"orange":"blue")}><Icon size={23}/></span>;
}
export function EmptyState({title,description,action,onAction}:{title:string;description:string;action?:string;onAction?:()=>void}){
  return <div className="empty-state"><span className="empty-symbol"><Landmark size={28}/></span><h3>{title}</h3><p>{description}</p>{action&&<button className="btn primary" onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div>;
}
export function EventRow({item,state,onOpen,compact=false}:{item:CivicItem;state:DemoState;onOpen:(item:CivicItem)=>void;compact?:boolean}){
  if(!item.event)return null;
  return <button className={"event-row "+(compact?"compact":"")} onClick={()=>onOpen(item)}>
    <span className="date-tile"><strong>{item.event.day}</strong><span>{item.event.month}</span></span>
    <span className="event-copy"><strong>{item.title}</strong><span>{item.event.weekday}, Sep {item.event.day} · {item.event.time}</span><span className="event-friends"><AvatarStack ids={item.event.friends}/>{state.plans.includes(item.id)?"You + ":""}{item.event.friends.length} demo friends going</span></span>
    <ChevronRight size={18}/>
  </button>;
}
export function ItemRow({item,state,onOpen,onRank,onSave}:{item:CivicItem;state:DemoState;onOpen:(item:CivicItem)=>void;onRank:(item:CivicItem)=>void;onSave:(id:string)=>void}){
  const ranking=state.rankings.find(r=>r.itemId===item.id);
  return <article className="item-row">
    <button className="item-main" onClick={()=>onOpen(item)}><ItemIcon item={item}/><span><span className="eyeline">{item.topic} · {item.kind==="Politicians"?"Fictional candidate":"Sample "+singular[item.kind]}</span><h3>{item.title}</h3><p>{item.subtitle}</p>{item.source&&<span className="metadata">{item.source} · 3 min read</span>}</span></button>
    <div className="item-actions"><Score value={ranking?.score??item.score} label={ranking?questions[item.kind].label:"Demo community"}/><button className="btn secondary small-btn" onClick={()=>onRank(item)}>{ranking?"Edit rating":"Rank"}</button><button className="icon-btn" onClick={()=>onSave(item.id)} aria-label={(state.saved.includes(item.id)?"Unsave ":"Save ")+item.title}>{state.saved.includes(item.id)?<BookmarkCheck size={19}/>:<Bookmark size={19}/>}</button></div>
  </article>;
}
export function PageHeading({title,description,children}:{title:string;description:string;children?:React.ReactNode}){return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{children}</div>;}
export type ViewProps={state:DemoState;onOpen:(item:CivicItem)=>void;onRank:(item?:CivicItem)=>void;onSave:(id:string)=>void;onNavigate:(view:View)=>void};
