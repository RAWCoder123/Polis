"use client";
import {useEffect,useState} from "react";
import {House,Map,ChartNoAxesColumnIncreasing,Users,UserRound,MapPin,Search,Plus,ChevronDown,ChevronRight,X,Asterisk,Info,Copy,Check} from "lucide-react";
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarFooter,SidebarMenu,SidebarMenuItem,SidebarMenuButton} from "@/components/ui/sidebar";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Toaster} from "@/components/ui/sonner";
import {toast} from "sonner";
import {items,itemById,kinds,type View,type CivicItem} from "@/lib/polis-data";
import {useDemoState,type Ranking} from "@/lib/polis-state";
import Discover from "./discover";
import {MapView,RankingsView,FriendsView,ProfileView} from "./views";
import {RankDialog,DetailSheet,AboutDialog,EditProfileDialog} from "./dialogs";
import {Avatar} from "./common";

const navigation=[{id:"discover",label:"Discover",short:"Discover",Icon:House},{id:"map",label:"Explore map",short:"Explore",Icon:Map},{id:"rankings",label:"My rankings",short:"Rankings",Icon:ChartNoAxesColumnIncreasing},{id:"friends",label:"Friends",short:"Friends",Icon:Users},{id:"profile",label:"My profile",short:"Profile",Icon:UserRound}] as const;
export default function PolisApp(){
  const {state,setState,ready,storageError,toggle,saveRanking,move,compare}=useDemoState();
  const [view,setView]=useState<View>("discover"),[category,setCategory]=useState("For you"),[query,setQuery]=useState("");
  const [detail,setDetail]=useState<CivicItem|null>(null),[rankOpen,setRankOpen]=useState(false),[rankItem,setRankItem]=useState<CivicItem|undefined>();
  const [about,setAbout]=useState(false),[editingProfile,setEditingProfile]=useState(false),[copyOpen,setCopyOpen]=useState(false),[copied,setCopied]=useState(false);
  useEffect(()=>{function sync(){const next=window.location.hash.slice(1);if(navigation.some(n=>n.id===next)){setView(next as View);if(next==="map")setState(s=>({...s,explored:true}));}else setView("discover");}sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync);},[setState]);
  function navigate(next:View){setView(next);setQuery("");window.location.hash=next;window.scrollTo({top:0,behavior:"instant"});if(next==="map")setState(s=>({...s,explored:true}));}
  function openItem(item:CivicItem){setDetail(item);if(item.kind==="News")setState(s=>({...s,read:s.read.includes(item.id)?s.read:[...s.read,item.id]}));}
  function rank(item?:CivicItem){setDetail(null);setRankItem(item);setRankOpen(true);}
  function save(id:string){const wasSaved=state.saved.includes(id);toggle("saved",id);toast.success(wasSaved?"Removed from saved items":"Saved for a little later");}
  function plan(id:string){const wasPlanned=state.plans.includes(id);toggle("plans",id);toast.success(wasPlanned?"Removed from your demo plans":"Added to your demo plans",{description:"Saved on this device only. No booking has been made."});}
  function onSaveRanking(r:Ranking){saveRanking(r);toast.success("Your perspective is saved",{description:"Only on this device. You can edit it anytime."});}
  function removeRanking(id:string){const previous=state.rankings;setState(s=>({...s,rankings:s.rankings.filter(r=>r.itemId!==id)}));toast("Ranking removed",{action:{label:"Undo",onClick:()=>setState(s=>({...s,rankings:previous}))}});}
  const copyText=state.profileName+"’s Polis demo rankings\n\n"+kinds.map(kind=>{const list=state.rankings.filter(r=>itemById[r.itemId].kind===kind);return list.length?kind+"\n"+list.map((r,i)=>(i+1)+". "+itemById[r.itemId].title+" — "+r.score.toFixed(1)+"/10"+(r.note?"\n   "+r.note:"")).join("\n"):"";}).filter(Boolean).join("\n\n")+"\n\nIllustrative demo content. These are personal ratings, not verified facts or representative polling.";
  async function copyLists(){try{await navigator.clipboard.writeText(copyText);setCopied(true);toast.success("Ranking lists copied");}catch{toast("Select and copy the text below.");}}
  const props={state,onOpen:openItem,onRank:rank,onSave:save,onNavigate:navigate};
  return <SidebarProvider className="polis-shell" style={{"--sidebar-width":"232px"} as React.CSSProperties}><a href="#main-content" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById("main-content")?.focus();document.getElementById("main-content")?.scrollIntoView();}}>Skip to content</a>
    <Sidebar className="polis-sidebar" collapsible="offcanvas"><SidebarHeader className="brand-wrap"><button className="brand" onClick={()=>navigate("discover")} aria-label="Polis home"><Asterisk size={36} strokeWidth={3.3}/><span>polis</span></button></SidebarHeader><SidebarContent><SidebarMenu className="nav-list">{navigation.map(({id,label,Icon})=><SidebarMenuItem key={id}><SidebarMenuButton className="nav-button" isActive={view===id} onClick={()=>navigate(id)} aria-current={view===id?"page":undefined}><Icon size={21}/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="sidebar-footer"><button className="location-summary" onClick={()=>setAbout(true)}><MapPin size={21}/><span><strong>Ithaca, NY</strong><span>Demo community</span></span></button><button className="sidebar-profile" onClick={()=>navigate("profile")}><Avatar initials={state.profileName.slice(0,1).toUpperCase()}/><strong>{state.profileName}</strong><ChevronRight size={16}/></button></SidebarFooter></Sidebar>
    <div className="app-main"><header className="topbar"><button className="brand mobile-brand" onClick={()=>navigate("discover")} aria-label="Polis home"><Asterisk size={30} strokeWidth={3.1}/><span>polis</span></button><div className="search-field"><Search size={20}/><input type="search" aria-label="Search your community" placeholder="Search your community" value={query} onChange={e=>{setQuery(e.target.value);setView("discover");setCategory("For you");if(window.location.hash!=="#discover")window.history.replaceState(null,"","#discover");}}/>{query&&<button className="icon-btn" onClick={()=>setQuery("")} aria-label="Clear search"><X size={15}/></button>}</div><button className="location-button" onClick={()=>setAbout(true)}><MapPin size={18}/><span>Ithaca, NY</span><ChevronDown size={15}/></button><Button className="btn primary add-ranking-button" onClick={()=>rank()} disabled={!ready}><Plus size={19}/><span>Add a ranking</span></Button></header>
      {storageError&&<div className="storage-notice" role="status">Your browser couldn’t save this demo. Changes will last for this session only.</div>}
      {view==="discover"?<Discover {...props} category={category} onCategory={setCategory} query={query}/>:view==="map"?<MapView state={state} onOpen={openItem} onPlan={plan} onShowFriends={v=>setState(s=>({...s,showFriendRsvps:v}))}/>:view==="rankings"?<RankingsView state={state} onOpen={openItem} onRank={rank} onMove={move} onRemove={removeRanking} onCopy={()=>{setCopied(false);setCopyOpen(true);}}/>:view==="friends"?<FriendsView state={state} onOpen={openItem} onFollow={id=>{toggle("following",id);toast.success(state.following.includes(id)?"Unfollowed sample profile":"Following sample profile");}}/>:<ProfileView {...props} onEdit={()=>setEditingProfile(true)}/>}
      <footer className="app-footer"><button onClick={()=>setAbout(true)}><Info size={14}/>About this demo</button></footer>
    </div>
    <nav className="mobile-nav" aria-label="Main navigation">{navigation.map(({id,short,Icon})=><button key={id} onClick={()=>navigate(id)} className={view===id?"active":""} aria-current={view===id?"page":undefined}><Icon size={22}/><span>{short}</span></button>)}</nav>
    <DetailSheet item={detail} state={state} onClose={()=>setDetail(null)} onOpen={openItem} onRank={rank} onSave={save} onPlan={plan}/>
    {rankOpen&&<RankDialog initialItem={rankItem} state={state} onClose={()=>setRankOpen(false)} onSave={onSaveRanking} onCompare={(a,b)=>{compare(a,b);toast.success("Your list order is updated");}}/>}
    {about&&<AboutDialog onClose={()=>setAbout(false)}/>}
    {editingProfile&&<EditProfileDialog state={state} onClose={()=>setEditingProfile(false)} onSave={(name,bio)=>{setState(s=>({...s,profileName:name,bio}));toast.success("Demo profile updated");}}/>}
    <Dialog open={copyOpen} onOpenChange={setCopyOpen}><DialogContent className="polis-dialog"><DialogHeader><DialogTitle>Your perspectives, ready to share.</DialogTitle><DialogDescription>This copies your lists as text. Nothing is posted or sent.</DialogDescription></DialogHeader><textarea className="copy-preview" aria-label="Ranking lists to copy" value={copyText} readOnly rows={12} onFocus={e=>e.target.select()}/><Button className="btn primary full" onClick={copyLists}>{copied?<Check size={17}/>:<Copy size={17}/>}{copied?"Copied":"Copy lists"}</Button></DialogContent></Dialog>
    <Toaster theme="light" position="bottom-right" richColors closeButton/>
  </SidebarProvider>;
}
