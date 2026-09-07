function Nt(){
  const s=le(),[t,r]=n.useState(0),c=n.useRef(null),b=n.useRef(!1),v=n.useRef(null),d=[{"tag":"Learn","headline":"Learn Skills That Matter.","support":"Build practical skills for the real world.","ctaLabel":"Start Learning","ctaTo":"/courses","src":"https://images.unsplash.com/photo-1517841905240-4731827be3ff?w=1200&q=80","width":1200,"height":800,"alt":"Young person learning and building digital skills at a laptop"},{"tag":"Career Roadmap","headline":"Find Your Career Path.","support":"Discover where your skills can take you.","ctaLabel":"Explore Roadmap","ctaTo":"/roadmap","src":"https://images.unsplash.com/photo-1523240768885-7d887fdf2e08?w=1200&q=80","width":1200,"height":800,"alt":"Person moving along a career pathway journey"},{"tag":"Build","headline":"Build. Practice. Grow.","support":"Turn knowledge into real experience.","ctaLabel":"Start Building","ctaTo":"/courses","src":"https://images.unsplash.com/photo-1553877522-43269d4ea999?w=1200&q=80","width":1200,"height":800,"alt":"Someone building a real creative digital project"},{"tag":"Opportunities","headline":"Turn Skills Into Opportunities.","support":"Connect your learning to your future.","ctaLabel":"Explore Opportunities","ctaTo":"/dashboard","src":"https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80","width":1200,"height":800,"alt":"People collaborating and growing professionally together"}],
  u=n.useCallback(()=>{b.current=!0;v.current&&clearTimeout(v.current)},[]),
  g=n.useCallback(()=>{v.current&&clearTimeout(v.current);v.current=window.setTimeout(()=>{b.current=!1},3e3)},[]);
  n.useEffect(()=>{const o=c.current;if(!o)return;const m={passive:!0},y=()=>u(),C=()=>g();
    return o.addEventListener("pointerdown",y,m),o.addEventListener("pointerup",C,m),o.addEventListener("wheel",y,m),
    o.addEventListener("focusin",y),o.addEventListener("focusout",C),
    ()=>{o.removeEventListener("pointerdown",y),o.removeEventListener("pointerup",C),o.removeEventListener("wheel",y),
    o.removeEventListener("focusin",y),o.removeEventListener("focusout",C)}},[u,g]),
  n.useEffect(()=>{if(s)return;const o=window.setInterval(()=>{document.hidden||b.current||r(m=>(m+1)%d.length)},5e3);
    return ()=>window.clearInterval(o)},[d.length,s]),
  n.useEffect(()=>()=>{v.current&&clearTimeout(v.current)},[]);
  return e.jsxs("div",{ref:c,className:"group relative mx-auto w-full max-w-full rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/50 sm:max-w-none sm:rounded-3xl lg:max-w-[1100px]",
    children:[
      e.jsx("div",{className:"relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] overflow-hidden bg-[#05070a]",
        children:d.map((o,m)=>{const y=m===t;
          return e.jsxs(l.div,{animate:{opacity:y?1:0,y:y?0:12},transition:{duration:s?0:.55,ease:[.22,1,.36,1]},
            className:"absolute inset-0",children:[
              e.jsx("img",{src:o.src,width:o.width,height:o.height,alt:o.alt,loading:"lazy",decoding:"async",
                className:"h-full w-full object-cover"},
              e.jsx("div",{className:"pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070a]/95 via-[#05070a]/35 to-transparent"}),
              e.jsxs("div",{className:"absolute bottom-0 left-0 z-10 max-w-[94vw] sm:max-w-[460px] lg:max-w-[560px] p-6 sm:p-7 lg:p-9",
                children:[
                  e.jsx("p",{className:"font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-lime-300",children:o.tag}),
                  e.jsx("h2",{className:"font-display mt-2 text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl",children:o.headline}),
                  e.jsx("p",{className:"mt-2 text-[13px] leading-relaxed text-white/80 sm:text-sm lg:text-base",children:o.support}),
                  e.jsxs("ul",{className:"list-none mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-x-3 sm:gap-y-0",
                    children:[
                      e.jsxs("li",{className:"flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-4 py-3 sm:bg-transparent sm:justify-between",
                        children:[e.jsx("span",{className:"text-[13px] font-semibold text-white",children:o.ctaLabel}),
                          e.jsx(P,{className:"size-4 transition-transform group-hover:translate-x-0.5"}),
                          e.jsx("span",{className:"text-[11px] font-medium text-muted-foreground/80"}),
                          e.jsx("span",{className:"text-[11px] font-medium text-muted-foreground/80"})]},
                        o.tag),
                      e.jsxs("li",{className:"flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-transparent px-4 py-3 sm:bg-transparent sm:justify-between",
                        children:[e.jsx(ne,{className:"size-4 text-white"}),
                          e.jsx("span",{className:"text-[13px] font-semibold text-white/90",children:t===1?"View all paths":t===3?"See all opportunities":t===0?"Explore roadmaps":"Browse courses"}),
                          e.jsx(P,{className:"size-4 transition-transform group-hover:translate-x-0.5"})]
                        },
                        o.tag)
                    ]}),
                ]})]},
            o.tag)})}),
      e.jsx("div",{className:"absolute left-5 sm:left-7 bottom-10 sm:bottom-12",
        children:e.jsx("span",{className:"h-px w-9 bg-lime-400 drop-shadow-[0_0_10px_rgba(166,255,0,0.6)]"}}),
      e.jsxs("div",{className:"absolute right-5 sm:right-7 sm:bottom-10 sm:bottom-12 z-10 flex items-center gap-2",
        children:[
          e.jsx("button",{onClick:()=>{u();r((m=>(m-1+d.length)%d.length))},className:"flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 transition-colors active:scale-90 hover:bg-white/5","aria-label":"Previous slide",children:e.jsx(Oh,{className:"size-5 text-white/80"})},
            e.jsx("button",{onClick:()=>{u();r((m=>(m+1)%d.length))},className:"flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 transition-colors active:scale-90 hover:bg-white/5","aria-label":"Next slide",children:e.jsx(Ye,{className:"size-5 text-white/80"})},
        ]}),
      e.jsx("div",{className:"absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-2 sm:gap-1.5",
        children:d.map((o,m)=>e.jsx("button",{onClick:()=>{u();r(m);g()},className:"flex rounded-full",
          "aria-label":`Go to slide ${m+1}`,"aria-current":m===t,
          children:e.jsx("span",{className:"block h-1.5 rounded-full transition-all duration-500",style:{transitionTimingFunction:"cubic-bezier(0.22, 1, 0.36, 1)"},
            children:m===t?e.jsx("span",{className:"h-full w-5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(166,255,0,0.6)]"}):
            e.jsx("span",{className:"h-full w-1.5 rounded-full bg-white/30 hover:bg-white/50"})},
            m)})}),
    ]});
}
