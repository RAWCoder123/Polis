"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowDown, ArrowUp, ArrowUpRight, Asterisk, Bookmark,
  Check, ChevronRight, Compass, HeartHandshake, LockKeyhole, MapPin,
  Menu, MessageCircle, MessagesSquare, MoveUpRight, Send, ShieldCheck,
  Sparkles, ThumbsUp, Users, X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import "./showcase.css";

const signIn = "/signin-with-chatgpt?return_to=%2F%23home";
const starterPriorities = ["Housing we can afford", "Getting around town", "Greener public spaces"];

function InviteLink({ className, children, invitation = false }: { className?: string; children: ReactNode; invitation?: boolean }) {
  const destination = invitation ? "/#join" : "/#signup";
  return <Link className={className} href={destination} prefetch={false} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // The existing app subscribes to native hash navigation, including login returns.
    event.preventDefault();
    window.location.assign(destination);
  }}>{children}</Link>;
}

function Brand() {
  return <a className="sc-brand" href="/welcome" aria-label="Polis — about the community"><Asterisk aria-hidden="true" /><span>polis</span></a>;
}

function ProductPreview() {
  const [reaction, setReaction] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [saved, setSaved] = useState(false);
  const [priorities, setPriorities] = useState(starterPriorities);
  const [update, setUpdate] = useState("");
  function move(index: number, step: number) {
    const next = [...priorities];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setPriorities(next);
    setUpdate(`${next[index + step]} is now priority ${index + step + 1}.`);
  }
  return <div className="sc-product">
    <div className="sc-product-heading"><span><Asterisk size={24} aria-hidden="true" /> A little more connected.</span><span className="sc-example-label">Interactive preview</span></div>
    <Tabs defaultValue="conversation">
      <TabsList className="sc-tabs" aria-label="Explore the Polis preview">
        <TabsTrigger value="conversation">Conversation</TabsTrigger>
        <TabsTrigger value="priorities">Priorities</TabsTrigger>
        <TabsTrigger value="nearby">Nearby</TabsTrigger>
      </TabsList>
      <TabsContent value="conversation" className="sc-preview-panel">
        <div className="sc-person"><span className="sc-avatar">A</span><div><strong>Alex</strong><span>Example post · Friends</span></div><MessagesSquare size={19} aria-hidden="true" /></div>
        <div className="sc-post-topic"><span>GETTING AROUND TOWN</span><h3>A later bus. A little more possibility.</h3></div>
        <p>More evening buses could make it easier to get home from work, stay for a campus event, or see a friend. What would make the biggest difference for you?</p>
        <div className="sc-reactions" aria-label="Try a reaction">
          {[{ name: "Agree", Icon: ThumbsUp }, { name: "Thoughtful", Icon: Sparkles }, { name: "Curious", Icon: MessageCircle }].map(({ name, Icon }) => <button type="button" key={name} aria-pressed={reaction === name} onClick={() => setReaction(reaction === name ? null : name)}><Icon size={16} aria-hidden="true" />{name}{reaction === name && <Check size={13} aria-hidden="true" />}</button>)}
        </div>
        {reply && <div className="sc-preview-reply"><span className="sc-avatar sc-avatar-you">Y</span><p><strong>You · Preview only</strong>{reply}</p></div>}
        <form className="sc-reply-form" onSubmit={e => { e.preventDefault(); if (draft.trim()) { setReply(draft.trim()); setDraft(""); } }}>
          <label className="sr-only" htmlFor="showcase-reply">Try a reply in the preview</label><input id="showcase-reply" maxLength={180} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Try a thoughtful reply…" />
          <button type="submit" disabled={!draft.trim()} aria-label="Add preview reply"><Send size={17} aria-hidden="true" /></button>
        </form>
        <span role="status" className="sr-only">{reaction ? `${reaction} reaction selected in this preview.` : "No preview reaction selected."}{reply ? " Preview reply added." : ""}</span>
      </TabsContent>
      <TabsContent value="priorities" className="sc-preview-panel">
        <span className="sc-small-label"><LockKeyhole size={15} aria-hidden="true" /> Private until you share</span>
        <h3 className="sc-preview-title">What matters most to you?</h3>
        <p>Start with your community. Put your priorities in your own order.</p>
        <ol className="sc-priorities">{priorities.map((item, i) => <li key={item}><span className="sc-rank-number">0{i + 1}</span><strong>{item}</strong><div><button aria-label={`Move ${item} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button><button aria-label={`Move ${item} down`} disabled={i === priorities.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button></div></li>)}</ol>
        <p className="sc-preview-hint">Try moving an issue. In Polis, you choose whether to share a snapshot with others.</p><span role="status" className="sr-only">{update}</span>
      </TabsContent>
      <TabsContent value="nearby" className="sc-preview-panel">
        <span className="sc-small-label"><MapPin size={15} aria-hidden="true" /> Around the corner</span>
        <h3 className="sc-preview-title">A reason to get together.</h3>
        <p>From public meetings to farmers markets, find more of the community around you.</p>
        <div className="sc-preview-event"><div className="sc-event-icon"><HeartHandshake size={29} aria-hidden="true" /></div><div><span>VOLUNTEERING</span><h4>Neighborhood garden day</h4><p>Illustrative listing · No scheduled date</p></div></div>
        <button className="sc-button sc-button-outline sc-preview-save" aria-pressed={saved} onClick={() => setSaved(!saved)}>{saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? "Saved in preview" : "Try saving an event"}</button>
        <p className="sc-preview-hint" role="status">{saved ? "Saved here for this preview. Click again to undo." : "Saving is private. Plans and organizer registration are separate."}</p>
      </TabsContent>
    </Tabs>
    <div className="sc-product-footnote"><span>Fictional examples. Preview actions are not published or saved to an account.</span><a href="/demo" aria-label="Open the full fictional demo"><ArrowUpRight size={19} /></a></div>
  </div>;
}

export function PolisShowcase() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="polis-showcase">
    <a className="skip-link" href="#showcase-main">Skip to content</a>
    <header className="sc-header">
      <div className="sc-header-inner"><Brand />
        <button className="sc-menu-toggle" aria-expanded={menuOpen} aria-controls="showcase-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        <nav id="showcase-navigation" className={menuOpen ? "sc-navigation is-open" : "sc-navigation"} aria-label="About Polis" onKeyDown={e => { if (e.key === "Escape") { setMenuOpen(false); document.querySelector<HTMLButtonElement>(".sc-menu-toggle")?.focus(); } }}>
          <a href="#why-polis" onClick={() => setMenuOpen(false)}>Why Polis</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#pilot" onClick={() => setMenuOpen(false)}>The pilot</a>
          <a className="sc-signin" href={signIn} target="_top">Log in <ArrowUpRight size={16} aria-hidden="true" /></a>
        </nav>
        <InviteLink className="sc-button sc-header-cta">Create account <ArrowUpRight size={16} aria-hidden="true" /></InviteLink>
      </div>
    </header>
    <main id="showcase-main" tabIndex={-1}>
      <section className="sc-hero sc-container" aria-labelledby="showcase-heading">
        <div className="sc-hero-copy"><p className="sc-eyebrow"><span /> A little more local. A lot more connected.</p>
          <h1 id="showcase-heading">Politics starts<br />close to <em>home.</em></h1>
          <p className="sc-hero-description">The issues you care about. The people around you. The places you belong. Meet Polis—a more connected way to take part in your community.</p>
          <div className="sc-hero-actions"><InviteLink className="sc-button">Get started <ArrowUpRight size={19} aria-hidden="true" /></InviteLink><a className="sc-text-link" href="#how-it-works">Meet Polis <ArrowDown size={17} aria-hidden="true" /></a></div>
          <div className="sc-pilot-note"><MapPin size={17} aria-hidden="true" /><span>Starting in Cornell / Ithaca.<br /><strong>Built for the places we call home.</strong></span></div>
        </div>
        <figure className="sc-hero-visual">
          <div className="sc-photo-wrap"><Image src="/images/polis-community.webp" width={1122} height={1402} alt="Illustrative scene of neighbors talking together at an outdoor community market" priority unoptimized className="sc-hero-image" />
            <span className="sc-photo-label"><MapPin size={14} aria-hidden="true" /> Closer to your community</span>
          </div>
          <div className="sc-floating-card"><span className="sc-floating-icon"><MessagesSquare size={22} aria-hidden="true" /></span><div><span>GOOD THINGS START HERE</span><strong>“What matters to you?”</strong><p>A question. A conversation. A connection.</p></div></div>
          <figcaption>Illustrative community scene · AI-generated</figcaption>
        </figure>
      </section>
      <div className="sc-manifesto" aria-label="The Polis idea"><div className="sc-container"><span>Know your neighborhood</span><Asterisk aria-hidden="true" /><span>Find your people</span><Asterisk aria-hidden="true" /><span>Shape what’s next</span></div></div>
      <section className="sc-intro sc-container" id="why-polis" aria-labelledby="why-heading">
        <p className="sc-eyebrow">YOUR WORLD IS CLOSER THAN YOU THINK</p><div><h2 id="why-heading">A shared place.<br />A world of perspectives.</h2><p>Housing. Transit. A favorite public space. The decisions closest to us shape our everyday lives. Polis brings those conversations closer, too—with room to ask, listen, and find your own point of view.</p></div>
      </section>
      <section className="sc-how sc-container" id="how-it-works" aria-labelledby="how-heading">
        <div className="sc-how-copy"><p className="sc-eyebrow">LESS DISTANT. MORE PERSONAL.</p><h2 id="how-heading">Big questions.<br />Closer conversations.</h2>
          <div className="sc-step"><span>01</span><div><h3>Start with what matters.</h3><p>Explore local issues and put your priorities in your own order.</p></div></div>
          <div className="sc-step"><span>02</span><div><h3>Bring your perspective.</h3><p>Share a view, ask a question, or say you’re still learning. There’s room for all three.</p></div></div>
          <div className="sc-step"><span>03</span><div><h3>Keep the conversation going.</h3><p>Hear from a friend. Respond with curiosity. Come back when there’s more to talk about.</p></div></div>
          <a className="sc-text-link" href="/demo">Explore the interactive demo <ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
        <ProductPreview />
      </section>
      <section className="sc-local" id="community" aria-labelledby="local-heading"><div className="sc-container sc-local-grid">
        <figure><div className="sc-street-photo"><Image src="/images/community-street.webp" width={1536} height={1024} unoptimized alt="Illustrative tree-lined college-town street with shops and people walking" loading="lazy" /></div><figcaption>Illustrative neighborhood · AI-generated</figcaption></figure>
        <div className="sc-local-copy"><p className="sc-eyebrow">THERE’S A WORLD OUTSIDE THE FEED</p><h2 id="local-heading">Find a reason<br />to show up.</h2><p>A neighborhood market. A volunteer morning. A meeting about your street. Discover the everyday moments that turn a place into a community.</p>
          <ul className="sc-event-categories" aria-label="Community event categories"><li>Food & markets</li><li>Arts & culture</li><li>Volunteering</li><li>Civic meetings</li></ul>
          <a className="sc-text-link" href="/demo#map">Take a look around <MoveUpRight size={18} aria-hidden="true" /></a><p className="sc-fine-print">Explore fictional events in the demo. In Polis, saving an event or marking “Going” doesn’t complete organizer registration.</p>
        </div>
      </div></section>
      <section className="sc-values" aria-labelledby="values-heading"><div className="sc-container"><div className="sc-values-heading"><p className="sc-eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p><h2 id="values-heading">Different views.<br /><em>Shared ground.</em></h2><p>You don’t have to agree on everything to care about the same place.</p></div>
        <div className="sc-value-list"><article><Users aria-hidden="true" /><h3>People before labels.</h3><p>Get to know a person’s perspective. Polis doesn’t assign political identities.</p></article><article><LockKeyhole aria-hidden="true" /><h3>Your voice. Your choice.</h3><p>Choose who sees your posts. Personal priorities and saved items start private.</p></article><article><ShieldCheck aria-hidden="true" /><h3>Space for better conversations.</h3><p>Stay curious. Use mute, block, and report when you need them.</p></article></div>
      </div></section>
      <section className="sc-pilot sc-container" id="pilot" aria-labelledby="pilot-heading"><div className="sc-pilot-box"><div><span className="sc-small-label"><Compass size={17} aria-hidden="true" /> THE POLIS PILOT</span><h2 id="pilot-heading">Your community is<br />better with <em>you.</em></h2><p>Create your account and bring your questions, priorities, and perspective. Join a university or organization community with a code whenever you’re ready.</p><InviteLink className="sc-button">Get started <ArrowUpRight size={19} aria-hidden="true" /></InviteLink><span className="sc-join-note">No invitation needed to create your account.</span></div><Asterisk className="sc-pilot-star" aria-hidden="true" /></div>
        <div className="sc-faq"><h3>A few things to know.</h3><Accordion type="single" collapsible className="sc-faq-items"><AccordionItem value="join"><AccordionTrigger>How do I join the pilot?</AccordionTrigger><AccordionContent>Create your Polis profile after signing in through OpenAI with email, Google, or your existing ChatGPT account. No invitation is required. Community codes are optional and let you join a specific university or organization.</AccordionContent></AccordionItem><AccordionItem value="party"><AccordionTrigger>Do I have to pick a political side?</AccordionTrigger><AccordionContent>No. Polis is a place to explore civic priorities and have conversations. You can support, oppose, feel mixed, or still be learning about an issue. Your activity isn’t used to assign you a political label.</AccordionContent></AccordionItem><AccordionItem value="preview"><AccordionTrigger>Is the preview real community activity?</AccordionTrigger><AccordionContent>No. The examples on this page and in the demo are fictional. Preview reactions, replies, and saves aren’t published. Real community activity is available to signed-in members according to each post’s audience.</AccordionContent></AccordionItem></Accordion></div>
      </section>
    </main>
    <footer className="sc-footer sc-container"><div><Brand /><p>Your community, in focus.</p></div><nav aria-label="Footer"><InviteLink invitation>Optional community code <ChevronRight size={16} aria-hidden="true" /></InviteLink><a href="/demo">Explore the demo</a><a href={signIn} target="_top">Member login</a></nav><p className="sc-footer-note">An independent community pilot.<br />Not affiliated with or endorsed by Cornell University.</p></footer>
  </div>;
}
