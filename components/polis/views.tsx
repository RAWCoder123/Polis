"use client";
import {useState} from "react";
import {ArrowUp,ArrowDown,ArrowRight,Bookmark,CalendarDays,Check,ChevronRight,Copy,Compass,Globe,Lock,MapPin,Pencil,Trash2,Users,BookOpen,MessageSquare,Plus,Ticket} from "lucide-react";
import {Tabs,TabsList,TabsTrigger,TabsContent} from "@/components/ui/tabs";
import {Switch} from "@/components/ui/switch";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {items,itemById,kinds,friends,questions,type Kind,type CivicItem} from "@/lib/polis-data";
import type {DemoState,Ranking} from "@/lib/polis-state";
import {Avatar,Score,ItemIcon,ItemRow,EventRow,PageHeading,EmptyState,type ViewProps} from "./common";
import CommunityMap from "./community-map";

export function MapView({state,onOpen,onPlan,onShowFriends}:{state:DemoState;onOpen:(i:CivicItem)=>void;onPlan:(id:string)=>void;onShowFriends:(v:boolean)=>void}){
  const [filter,setFilter]=useState("All events"),[selected,setSelected]=useState("housing-meeting");
  const events=items.filter(i=>i.event&&(filter==="All events"||i.event.type===filter));
  const selectedItem=events.find(i=>i.id===selected);
  return (
    <main className="wide-view map-view" id="main-content" tabIndex={-1}>
      <PageHeading title="A little closer to your community." description="Find a reason to get out there. Bring a friend."/>
      <Tabs value={filter} onValueChange={value=>{setFilter(value);setSelected("");}} className="map-tabs">
        <div className="map-toolbar">
          <TabsList className="pill-tabs" aria-label="Event types">
            {["All events","Town halls","Volunteering","Meetups"].map(f=><TabsTrigger value={f} key={f}>{f}</TabsTrigger>)}
          </TabsList>
          <label className="switch-label"><Switch checked={state.showFriendRsvps} onCheckedChange={onShowFriends} aria-label="Show friends’ event RSVPs"/>Friends’ RSVPs</label>
        </div>
        {["All events","Town halls","Volunteering","Meetups"].map(f=>(
          <TabsContent key={f} value={f}>
            {filter===f&&(
              <div className="map-layout">
                <div className="large-map-wrap">
                  <CommunityMap visibleItems={events} selected={selected} onSelect={i=>setSelected(i.id)} showFriends={state.showFriendRsvps} following={state.following}/>
                  {selectedItem&&(
                    <div className="map-event-callout">
                      <span className="eyeline">Sample event · Sep {selectedItem.event?.day}</span>
                      <strong>{selectedItem.title}</strong>
                      <button className="text-button" onClick={()=>onOpen(selectedItem)}>See event<ArrowRight size={15}/></button>
                    </div>
                  )}
                </div>
                <section className="map-event-list">
                  <div className="section-heading"><h2>Coming up nearby</h2><span className="result-count">{events.length} {events.length===1?"event":"events"}</span></div>
                  <p className="metadata">Demo week · September 9–15, 2026</p>
                  {events.map(item=>(
                    <article key={item.id} className={"map-event-card "+(selected===item.id?"active":"")}>
                      <button className="map-card-main" onClick={()=>setSelected(item.id)}>
                        <span className="eyeline">{item.event?.type} · {item.topic}</span>
                        <h3>{item.title}</h3>
                        <p><CalendarDays size={14}/>Sep {item.event?.day} · {item.event?.time}</p>
                        <p><MapPin size={14}/>{item.event?.place}</p>
                      </button>
                      <div className="map-card-actions">
                        <button className={"btn small-btn "+(state.plans.includes(item.id)?"secondary":"primary")} onClick={()=>onPlan(item.id)}>
                          {state.plans.includes(item.id)?<Check size={15}/>:<Plus size={15}/>}
                          {state.plans.includes(item.id)?"In your plans":"I’m interested"}
                        </button>
                        <button className="text-button" onClick={()=>onOpen(item)}>Details<ChevronRight size={16}/></button>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <p className="map-privacy"><Lock size={14}/>Friend markers show opt-in sample RSVPs. There is no live location tracking, and these events are fictional.</p>
    </main>
  );
}

export function RankingsView({state,onOpen,onRank,onMove,onRemove,onCopy}:{state:DemoState;onOpen:(i:CivicItem)=>void;onRank:(i?:CivicItem)=>void;onMove:(id:string,d:-1|1)=>void;onRemove:(id:string)=>void;onCopy:()=>void}){
  const [kind,setKind]=useState<Kind>("Policies");
  const rankings=state.rankings.filter(r=>itemById[r.itemId].kind===kind);
  return <main className="wide-view rankings-view" id="main-content" tabIndex={-1}><PageHeading title="Your perspective, in order." description="The ideas, people, and stories that matter to you."><button className="btn secondary" onClick={onCopy} disabled={!state.rankings.length}><Copy size={16}/>Copy my lists</button></PageHeading><Tabs value={kind} onValueChange={v=>setKind(v as Kind)}><TabsList variant="line" className="category-tabs" aria-label="Ranking categories">{kinds.map(k=><TabsTrigger key={k} value={k}>{k}<span className="tab-count">{state.rankings.filter(r=>itemById[r.itemId].kind===k).length}</span></TabsTrigger>)}</TabsList>{kinds.map(k=><TabsContent key={k} value={k}>{kind===k&&(rankings.length?<><div className="ranking-list-heading"><span>Your priority order</span><span>{questions[k].label}</span></div><div className="ranking-list">{rankings.map((r,index)=>{const item=itemById[r.itemId];return <article className="ranking-row" key={r.itemId}><span className="rank-position">{String(index+1).padStart(2,"0")}</span><button className="rank-item-main" onClick={()=>onOpen(item)}><ItemIcon item={item}/><span><span className="eyeline">{item.topic}</span><h3>{item.title}</h3>{r.note&&<p>“{r.note}”</p>}<span className="metadata visibility-tag">{r.audience==="Private"?<Lock size={12}/>:r.audience==="Friends"?<Users size={12}/>:<Globe size={12}/>} {r.audience} preview · On this device</span></span></button><Score value={r.score}/><div className="rank-controls"><button className="icon-btn" onClick={()=>onMove(item.id,-1)} aria-label={"Move "+item.title+" up"} disabled={index===0}><ArrowUp size={16}/></button><button className="icon-btn" onClick={()=>onMove(item.id,1)} aria-label={"Move "+item.title+" down"} disabled={index===rankings.length-1}><ArrowDown size={16}/></button><button className="icon-btn" onClick={()=>onRank(item)} aria-label={"Edit ranking for "+item.title}><Pencil size={16}/></button><button className="icon-btn" onClick={()=>onRemove(item.id)} aria-label={"Remove ranking for "+item.title}><Trash2 size={16}/></button></div></article>;})}</div><p className="ranking-help">Use the arrows to change your priority order. Your rating records {k==="News"?"usefulness":k==="Events"?"your sample experience":"personal support"} separately.</p><button className="btn secondary add-another" onClick={()=>onRank()}><Plus size={16}/>Add another perspective</button></>:<EmptyState title={"Make your first "+(k==="News"?"news":k==="Policies"?"policy":k==="Politicians"?"politician":"event")+" list."} description="Explore a sample and give it a rating. Your perspective starts with you." action="Add a ranking" onAction={()=>onRank()}/>)}</TabsContent>)}</Tabs><div className="quiet-note"><Lock size={17}/><p>Your views are yours. Audience settings are previews; nothing leaves this demo when you save a ranking.</p></div></main>;
}

export function FriendsView({state,onFollow,onOpen}:{state:DemoState;onFollow:(id:string)=>void;onOpen:(i:CivicItem)=>void}){
  const [active,setActive]=useState<string|null>(null),[filter,setFilter]=useState("Everyone");
  const selected=friends.find(f=>f.id===active);
  function similarity(person:typeof friends[number]){
    const ratings=person.ratings as Record<string,number|undefined>;
    const shared=state.rankings.filter(r=>typeof ratings[r.itemId]==="number");
    if(shared.length<2)return "Rank 2 shared items to compare";
    return Math.round(100-shared.reduce((sum,r)=>sum+Math.abs(r.score-ratings[r.itemId]!),0)/shared.length*10)+"% similar ratings · "+shared.length+" shared items";
  }
  const people=friends.filter(f=>filter==="Everyone"||state.following.includes(f.id));
  return <main className="wide-view friends-view" id="main-content" tabIndex={-1}><PageHeading title="Different perspectives. Familiar faces." description="See what your sample community is thinking about."/><Tabs value={filter} onValueChange={setFilter}><TabsList variant="line" className="category-tabs" aria-label="Friend lists">{["Everyone","Following"].map(f=><TabsTrigger key={f} value={f}>{f}</TabsTrigger>)}</TabsList>{["Everyone","Following"].map(f=><TabsContent key={f} value={f}>{filter===f&&<div className="friends-grid">{people.length?people.map(person=><article className="friend-card" key={person.id}><div className="friend-card-top"><button className="friend-identity" onClick={()=>setActive(person.id)}><Avatar id={person.id} size="large"/><span><h3>{person.name}</h3><span><MapPin size={13}/>{person.neighborhood}</span></span></button><button className={"btn small-btn "+(state.following.includes(person.id)?"secondary":"primary")} onClick={()=>onFollow(person.id)}>{state.following.includes(person.id)?<Check size={15}/>:<Plus size={15}/>}{state.following.includes(person.id)?"Following":"Follow"}</button></div><p>{person.bio}</p><div className="similarity"><span className="similarity-icon"><Users size={16}/></span>{similarity(person)}</div><div className="friend-preview"><span className="eyeline">A few of their perspectives</span>{Object.entries(person.ratings).slice(0,2).map(([id,score])=><button key={id} onClick={()=>onOpen(itemById[id])}><span>{itemById[id].title}</span><strong>{score?.toFixed(1)}</strong></button>)}</div><button className="text-button" onClick={()=>setActive(person.id)}>View sample profile<ArrowRight size={16}/></button></article>):<EmptyState title="Room for a new perspective." description="Follow someone from the Everyone tab to see their sample activity here."/>}</div>}</TabsContent>)}</Tabs><p className="demo-footnote">These are fictional demo profiles. Similarity compares only ratings on the same items; it does not infer political affiliation.</p>
    <Dialog open={!!selected} onOpenChange={open=>{if(!open)setActive(null);}}><DialogContent className="polis-dialog friend-dialog">{selected&&<><DialogHeader><Avatar id={selected.id} size="hero"/><DialogTitle>{selected.name}</DialogTitle><DialogDescription>{selected.bio} · Fictional profile</DialogDescription></DialogHeader><span className="similarity">{similarity(selected)}</span><section><h3>Their sample rankings</h3>{Object.entries(selected.ratings).map(([id,score])=><button key={id} className="related-row" onClick={()=>{setActive(null);onOpen(itemById[id]);}}><ItemIcon item={itemById[id]}/><span><strong>{itemById[id].title}</strong><span className="metadata">{itemById[id].kind}</span></span><Score small value={score??0}/></button>)}</section><button className={"btn full "+(state.following.includes(selected.id)?"secondary":"primary")} onClick={()=>onFollow(selected.id)}>{state.following.includes(selected.id)?"Following in this demo":"Follow in this demo"}</button></>}</DialogContent></Dialog>
  </main>;
}

export function ProfileView({state,onOpen,onRank,onSave,onNavigate,onEdit}:ViewProps&{onEdit:()=>void}){
  const [tab,setTab]=useState("Rankings");
  const badges=[{label:"First perspective",description:"Save your first ranking",done:state.rankings.length>0,Icon:MessageSquare},{label:"Curious reader",description:"Open two sample stories",done:state.read.length>=2,Icon:BookOpen},{label:"Neighborhood explorer",description:"Explore the community map",done:state.explored,Icon:Compass},{label:"A plan to show up",description:"Add an event to your plans",done:state.plans.length>0,Icon:Ticket}];
  return <main className="wide-view profile-view" id="main-content" tabIndex={-1}><div className="profile-identity"><Avatar initials={state.profileName.slice(0,1).toUpperCase()} color="blue" size="hero"/><div><span className="eyeline">Your demo profile</span><h1>{state.profileName}</h1><p>{state.bio}</p><span className="profile-location"><MapPin size={15}/>Ithaca, NY</span></div><button className="btn secondary" onClick={onEdit}><Pencil size={15}/>Edit profile</button></div><div className="profile-stats"><div><strong>{state.rankings.length}</strong><span>perspectives</span></div><div><strong>{state.following.length}</strong><span>following</span></div><div><strong>{state.plans.length}</strong><span>upcoming plans</span></div><div><strong>{state.saved.length}</strong><span>saved for later</span></div></div>
    <section className="passport-section"><div className="section-heading"><div><h2>Your civic passport</h2><p>Small steps, a closer community.</p></div><span className="passport-count">{badges.filter(b=>b.done).length} of 4 chapters</span></div><div className="passport-badges">{badges.map(b=><div key={b.label} className={"passport-badge "+(b.done?"earned":"")}><span className="badge-icon"><b.Icon size={26} strokeWidth={1.5}/>{b.done&&<span className="badge-check"><Check size={11}/></span>}</span><strong>{b.label}</strong><span>{b.description}</span></div>)}</div><p className="metadata">Progress records actions inside this demo, not verified real-world participation.</p></section>
    <Tabs value={tab} onValueChange={setTab}><TabsList variant="line" className="category-tabs" aria-label="Profile lists">{["Rankings","Saved","Plans"].map(t=><TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList><TabsContent value="Rankings">{state.rankings.length?<>{state.rankings.map(r=><ItemRow key={r.itemId} item={itemById[r.itemId]} state={state} onOpen={onOpen} onRank={onRank} onSave={onSave}/>)}<button className="text-button profile-list-link" onClick={()=>onNavigate("rankings")}>Organize your rankings<ArrowRight size={16}/></button></>:<EmptyState title="A fresh perspective starts here." description="Your profile has no assumed political views. Explore something that interests you." action="Find your first ranking" onAction={()=>onRank()}/>}</TabsContent><TabsContent value="Saved">{state.saved.length?state.saved.map(id=><ItemRow key={id} item={itemById[id]} state={state} onOpen={onOpen} onRank={onRank} onSave={onSave}/>):<EmptyState title="For a little later." description="Bookmark a story, policy, or candidate to find it here." action="Discover your community" onAction={()=>onNavigate("discover")}/>}</TabsContent><TabsContent value="Plans">{state.plans.length?<><p className="category-note">Demo plans only. No bookings or messages have been sent.</p>{state.plans.map(id=><EventRow key={id} item={itemById[id]} state={state} onOpen={onOpen}/>)}</>:<EmptyState title="Your next chapter is nearby." description="Explore the map and add a sample event to your plans." action="Explore the map" onAction={()=>onNavigate("map")}/>}</TabsContent></Tabs>
  </main>;
}
