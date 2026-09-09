"use client";
import {useState} from "react";
import {MapPin,Plus,Minus,RotateCcw,Users} from "lucide-react";
import {items,type CivicItem} from "@/lib/polis-data";
import {Avatar} from "./common";

function MapBase(){
  const blocks=Array.from({length:108},(_,i)=>({x:208+(i%9)*49,y:26+Math.floor(i/9)*55,w:34+(i%3)*3,h:38+(i%2)*3}));
  return <svg className="map-base" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="800" height="800" fill="#e9eee9"/>
    <path d="M0 0H248L215 98 167 167 178 246 137 288 96 341 0 321Z" fill="#b7dbef"/>
    <path d="M63 298C160 328 122 422 163 512S262 651 346 661 448 608 528 663 645 706 708 682 769 713 827 756" fill="none" stroke="#b7dbef" strokeWidth="21"/>
    <path d="M84 284C169 342 153 416 183 484S289 626 351 637 439 590 534 644 651 684 712 659 781 693 827 733" fill="none" stroke="#fff" strokeWidth="7"/>
    <path d="M10 345 70 318 105 388 112 480 61 541 8 480Z" fill="#c9e1c8"/>
    <path d="M593 0H800V278L740 305 666 259 617 158Z" fill="#d2e5cd"/>
    <path d="M494 697 542 678 619 733 709 710 797 754V800H511Z" fill="#c9e1c8"/>
    {blocks.map((b,i)=><rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill={i%13===0?"#d0e3cf":"#e2e5e2"} stroke="#fafcfb" strokeWidth="3"/>)}
    <g fill="none" stroke="#fff" strokeWidth="9"><path d="M194 0 187 147 202 320 196 480 201 650"/><path d="M383 0V613"/><path d="M538 0V631"/><path d="M192 289H800"/><path d="M176 450H788"/><path d="M228 569 403 569 558 532 800 493"/><path d="M9 666 209 650 355 670 457 623 687 406 800 357"/><path d="M655 0 649 249 734 416 800 525"/><path d="M800 106 695 207 637 297 715 458 786 579"/></g>
    <g fill="none" stroke="#fff" strokeWidth="4"><path d="M300 0V630"/><path d="M438 0V625"/><path d="M586 0V560"/><path d="M196 125H659"/><path d="M193 344H746"/><path d="M199 396H726"/><path d="M15 606H478"/><path d="M268 660V800"/><path d="M375 661 420 800"/><path d="M481 648 572 800"/></g>
    <g fontFamily="Arial,sans-serif" textAnchor="middle"><text x="88" y="92" fontSize="23" fill="#478aab" fontStyle="italic">Cayuga Lake</text><text x="77" y="427" fontSize="21" fill="#598569">Stewart Park</text><text x="700" y="188" fontSize="21" fill="#7b8c79">Cornell</text><text x="700" y="218" fontSize="21" fill="#7b8c79">University</text><text x="442" y="405" fontSize="37" fontWeight="600" letterSpacing="1" fill="#798381">Ithaca</text><text x="703" y="558" fontSize="18" fill="#89938b">COLLEGETOWN</text><text x="364" y="233" fontSize="17" fill="#90998f">FALL CREEK</text><text x="428" y="520" fontSize="17" fill="#89938b">DOWNTOWN</text><text x="611" y="756" fontSize="21" fill="#598569" fontStyle="italic">Six Mile Creek</text></g>
  </svg>;
}
export default function CommunityMap({compact=false,visibleItems=items.filter(i=>i.event),selected,onSelect,showFriends=true,following=[]}:{compact?:boolean;visibleItems?:CivicItem[];selected?:string;onSelect:(item:CivicItem)=>void;showFriends?:boolean;following?:string[]}){
  const [zoom,setZoom]=useState(1);
  return <div className={"community-map "+(compact?"compact-map":"full-map")}>
    <div className="map-world" style={{transform:"scale("+zoom+")"}}><MapBase/>
      {visibleItems.map(item=>item.event&&<button key={item.id} className={"map-pin "+(item.event.type==="Volunteering"?"orange ":"")+(selected===item.id?"selected":"")} style={{left:item.event.x+"%",top:item.event.y+"%"}} onClick={()=>onSelect(item)} aria-label={"View "+item.title} aria-pressed={selected===item.id}><MapPin size={compact?34:43} fill="currentColor" stroke="white" strokeWidth={1.5}/><span className="pin-dot"/>{showFriends&&item.event.friends.some(id=>following.includes(id))&&<span className="pin-friend"><Avatar id={item.event.friends.find(id=>following.includes(id))} size="tiny"/></span>}</button>)}
    </div>
    {!compact&&<><div className="map-key"><span><span className="key-dot"/>Community events</span><span><span className="key-dot orange"/>Volunteering</span>{showFriends&&<span><Users size={13}/>Friends’ RSVPs</span>}</div><div className="map-controls"><button className="icon-btn" aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(1.6,z+.2))} disabled={zoom>=1.6}><Plus size={20}/></button><button className="icon-btn" aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(1,z-.2))} disabled={zoom<=1}><Minus size={20}/></button><button className="icon-btn" aria-label="Reset map view" onClick={()=>setZoom(1)}><RotateCcw size={17}/></button></div></>}
    <span className="map-attribution">Illustrative map · Sample locations</span>
  </div>;
}
