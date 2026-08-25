"use client";
import { Check, ChevronLeft, ChevronRight, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { Anime } from "../data/anime";

export default function FeaturedCarousel({ anime }: { anime: Anime[] }) {
  const [active, setActive] = useState(0); const [inList, setInList] = useState(false); const current = anime[active];
  const choose = (index: number) => { setActive((index + anime.length) % anime.length); setInList(false); };
  const offset = (index: number) => { const raw = index - active; return raw > anime.length / 2 ? raw - anime.length : raw < -anime.length / 2 ? raw + anime.length : raw; };
  return <section className="featured-carousel" aria-label="Featured anime">
    <div className="featured-backgrounds" aria-hidden="true">{anime.map((item, index) => <video key={item.id} className={index === active ? "is-active" : ""} src={item.backgroundVideo} autoPlay loop muted playsInline preload={index === active ? "auto" : "metadata"} />)}</div><div className="featured-scrim" />
    <header className="catalog-navbar"><Link href="/" className="catalog-brand"><span>AV</span><strong>ANIME <em>VERSE</em></strong></Link><nav><a className="is-active" href="/explore">Home</a><a href="#trending">Trending</a><a href="#top-rated">Top Rated</a><a href="#genres">Genres</a></nav><button className="catalog-profile" aria-label="Open profile">A</button></header>
    <div className="featured-copy"><p className="eyebrow">FEATURED THIS WEEK</p><h1>{current.title}</h1><div className="featured-meta"><span>{current.year}</span><span>{current.episodes}</span><span>{current.type}</span></div><p className="featured-description">{current.description}</p><div className="featured-actions"><button className="watch-button"><Play size={17} fill="currentColor" />Watch Now</button><button className="list-button" onClick={() => setInList(value => !value)}>{inList ? <Check size={17} /> : <Plus size={17} />}{inList ? "In My List" : "My List"}</button></div></div>
    <div className="poster-stage">{anime.map((item, index) => <button key={item.id} className={`featured-poster ${index === active ? "is-active" : ""}`} style={{ "--offset": offset(index), "--poster": `url(${item.poster})`, "--poster-position": item.posterPosition } as CSSProperties} onClick={() => choose(index)} aria-label={`Show ${item.title}`}><span className="poster-art" /><span className="poster-title">{item.title}</span></button>)}</div>
    <div className="featured-controls"><button onClick={() => choose(active - 1)} aria-label="Previous featured anime"><ChevronLeft size={20} /></button><div className="carousel-dots">{anime.map((item, index) => <button key={item.id} className={index === active ? "is-active" : ""} onClick={() => choose(index)} aria-label={`Show ${item.title}`} />)}</div><button onClick={() => choose(active + 1)} aria-label="Next featured anime"><ChevronRight size={20} /></button></div>
  </section>;
}
