"use client";
import {useEffect,useState} from "react";
import {itemById, friends, type Audience, type Kind} from "./polis-data";
export type Ranking={itemId:string;score:number;note:string;audience:Audience};
export type DemoState={rankings:Ranking[];saved:string[];plans:string[];following:string[];read:string[];explored:boolean;showFriendRsvps:boolean;profileName:string;bio:string};
const initial:DemoState={rankings:[],saved:[],plans:[],following:["maya","oliver","sofia"],read:[],explored:false,showFriendRsvps:true,profileName:"Raymond",bio:"Getting to know my community, one perspective at a time."};
const KEY="polis-demo-v1";
function validIds(value:unknown){return Array.isArray(value)?value.filter((id):id is string=>typeof id==="string"&&!!itemById[id]):[];}
export function useDemoState(){
  // The preserved demo synchronizes browser storage after hydration and reports storage failures.
  /* eslint-disable react-hooks/set-state-in-effect */
  const [state,setState]=useState<DemoState>(initial);
  const [ready,setReady]=useState(false);
  const [storageError,setStorageError]=useState(false);
  useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);setState({...initial,rankings:Array.isArray(s.rankings)?s.rankings.filter((r:Ranking)=>itemById[r.itemId]&&Number.isFinite(r.score)&&r.score>=0&&r.score<=10&&typeof r.note==="string"&&["Private","Friends","Public"].includes(r.audience)):[],saved:validIds(s.saved),plans:validIds(s.plans).filter(id=>itemById[id].kind==="Events"),read:validIds(s.read),following:Array.isArray(s.following)?s.following.filter((id:string)=>friends.some(f=>f.id===id)):initial.following,explored:s.explored===true,showFriendRsvps:s.showFriendRsvps!==false,profileName:typeof s.profileName==="string"?s.profileName.slice(0,40):initial.profileName,bio:typeof s.bio==="string"?s.bio.slice(0,160):initial.bio});}}catch{setStorageError(true);}setReady(true);},[]);
  useEffect(()=>{if(!ready)return;try{localStorage.setItem(KEY,JSON.stringify(state));setStorageError(false);}catch{setStorageError(true);}},[state,ready]);
  const toggle=(key:"saved"|"plans"|"following",id:string)=>setState(s=>({...s,[key]:s[key].includes(id)?s[key].filter(x=>x!==id):[...s[key],id]}));
  const saveRanking=(ranking:Ranking)=>setState(s=>({...s,rankings:s.rankings.some(r=>r.itemId===ranking.itemId)?s.rankings.map(r=>r.itemId===ranking.itemId?ranking:r):[...s.rankings,ranking]}));
  const move=(id:string,direction:-1|1)=>setState(s=>{const item=itemById[id];const local=s.rankings.filter(r=>itemById[r.itemId].kind===item.kind);const i=local.findIndex(r=>r.itemId===id);const neighbor=local[i+direction];if(!neighbor)return s;const a=s.rankings.findIndex(r=>r.itemId===id),b=s.rankings.findIndex(r=>r.itemId===neighbor.itemId);const rankings=[...s.rankings];[rankings[a],rankings[b]]=[rankings[b],rankings[a]];return {...s,rankings};});
  const compare=(preferred:string,other:string)=>setState(s=>{const rankings=[...s.rankings];const a=rankings.findIndex(r=>r.itemId===preferred),b=rankings.findIndex(r=>r.itemId===other);if(a<0||b<0||a<b)return s;const [entry]=rankings.splice(a,1);rankings.splice(b,0,entry);return {...s,rankings};});
  const ranked=(kind?:Kind)=>state.rankings.filter(r=>!kind||itemById[r.itemId].kind===kind);
  return {state,setState,ready,storageError,toggle,saveRanking,move,compare,ranked};
}
