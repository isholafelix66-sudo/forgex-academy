function Nt(){
  const s=le(),[t,r]=n.useState(0),c=n.useRef(null),b=n.useRef(!1),v=n.useRef(null),
  d=[{tag:"Learn",headline:"Learn Skills That Matter.",support:"Build practical skills for the real world.",ctaLabel:"Start Learning",ctaTo:"/courses",src:"https://images.unsplash.com/photo-1523531294919-4bcd3c06f9c1?w=1200&q=80",width:1200,height:800,alt:"Young person learning digital skills on a laptop"},
  {tag:"Career Roadmap",headline:"Find Your Career Path.",support:"Discover where your skills can take you.",ctaLabel:"Explore Roadmap",ctaTo:"/roadmap",src:"https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80",width:1200,height:800,alt:"Two people discussing a career pathway together"},
  {tag:"Build",headline:"Build. Practice. Grow.",support:"Turn knowledge into real experience.",ctaLabel:"Start Building",ctaTo:"/courses",src:"https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&q=80",width:1200,height:800,alt:"A developer building a real project at a desk"},
  {tag:"Opportunities",headline:"Turn Skills Into Opportunities.",support:"Connect your learning to your future.",ctaLabel:"Explore Opportunities",ctaTo:"/dashboard",src:"https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80",width:1200,height:800,alt:"Professionals networking and growing together"}],
  u=n.useCallback(()=>{b.current=!0,v.current&&clearTimeout(v.current)},[]),
  g=n.useCallback(()=>{v.current&&clearTimeout(v.current);v.current=window.setTimeout(()=>{b.current=!1},3e3)},[]);
  return n.useEffect(()=>{const o=c.current;if(!o)return;const m={passive:!0},y=()=>u(),C=()=>g();
    return o.addEventListener("pointerdown",y,m),o.addEventListener("pointerup",C,m),o.addEventListener("wheel",y,m),
    o.addEventListener("focusin",y),o.addEventListener("focusout",C),
    ()=>{o.removeEventListener("pointerdown",y),o.removeEventListener("pointerup",C),o.removeEventListener("wheel",y),
    o.removeEventListener("focusin",y),o.removeEventListener("focusout",C)}},[u,g]),
  n.useEffect(()=>{if(s)return;const o=window.setInterval(()=>{document.hidden||b.current||r(m=>(m+1)%d.length)},5e3);
    return ()=>window.clearInterval(o)},[d.length,s]),
  n.useEffect(()=>()=>{v.current&&clearTimeout(v.current)},[]),
  e.jsxs("div",{ref:c,className:"group relative mx-auto w-full max-w-[340px] rounded-2xl overflow-hidden ring-1 ring-white/10 sm:max-w-[460px] lg:max-w-4xl",
    children:[
      e.jsx("div",{className:"relative aspect-[4/3] sm:aspect-[16/9] overflow-hidden bg-[#05070a]",
        children:d.map(o=>{const m=o===d[t];
          return e.jsxs(l.div,{animate:{opacity:m?1:0,y:m?0:10},transition:{duration:s?0:.5,ease:[.22,1,.36,1]},
            className:"absolute inset-0",children:[
              e.jsx("img",{src:o.src,width:o.width,height:o.height,alt:o.alt,loading:"lazy",decoding:"async",className:"h-full w-full object-cover"}),
              e.jsx("div",{className:"pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070a]/92 via-[#05070a]/30 to-transparent"}),
              e.jsxs("div",{className:"absolute bottom-0 left-0 z-10 max-w-[320px] p-5 sm:p-7 lg:max-w-[520px]",
                children:[
                  e.jsx("p",{className:"font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-lime-300",children:o.tag}),
                  e.jsx("h2",{className:"font-display mt-2 text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl",children:o.headline}),
                  e.jsx("p",{className:"mt-2 text-[13px] leading-relaxed text-white/80 sm:text-sm",children:o.support})
                ]})
            ]})},o.tag)}),
      e.jsxs("div",{className:"flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4 lg:justify-end",
        children:[
          e.jsx("ul",{className:"list-none flex w-full justify-center gap-2 sm:w-auto sm:justify-start",
            children:[{icon:ae,text:"Free to start"},{icon:ie,text:"Verifiable certificates"},{icon:Re,text:"Learn at your pace"}].map(o=>
              e.jsxs("li",{className:"flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:leading-relaxed",
                children:[e.jsx("span",{className:"mt-[1px] flex size-5 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300",children:e.jsx(o.icon,{className:"size-3.5"})}),
                  e.jsx("span",{className:"text-[13px] leading-snug text-white/80",children:o.text})]},
              o.text))}),
          e.jsxs("ul",{className:"list-none flex w-full justify-center gap-2 sm:w-auto sm:justify-start",
            children:[
              e.jsx("li",{children:e.jsxs(X,{to:d[t].ctaTo,className:"w-full justify-center",children:[d[t].ctaLabel,e.jsx(P,{className:"size-4 transition-transform group-hover:translate-x-0.5"})]})}),
              e.jsx("li",{children:e.jsxs(X,{to:t===1||t===3?t===1?"/roadmap":"/dashboard":"/courses",variant:"outline",className:"w-full justify-center",children:[e.jsx(ne,{className:"size-4"}),t===0?"Explore roadmaps":t===1?"View all paths":t===2?"Browse courses":"See all"]})})
            ]})
        ]}),
      e.jsx("div",{className:"absolute left-5 sm:left-7 bottom-12 sm:bottom-14",children:e.jsx("span",{className:"h-px w-9 bg-lime-400 drop-shadow-[0_0_10px_rgba(166,255,0,0.6)]"})}),
      e.jsxs("div",{className:"absolute bottom-3 sm:bottom-3 sm:left-1/2 sm:-translate-x-1/2 flex sm:flex sm:gap-1.5 sm:items-center md:relative md:static md:z-auto md:translate-x-0 -translate-x-0 md:bottom-auto md:flex-col md:flex-wrap md:justify-end md:gap-3 md:px-7 md:py-4 md:items-start",
        children:d.map((o,m)=>e.jsx("button",{onClick:()=>{u(),r(m),g()},className:"flex size-1.5 rounded-full transition-colors","aria-label":`Go to slide ${m+1}`,"aria-current":m===t,children:e.jsx("span",{className:I("block h-1.5 rounded-full transition-all duration-500",m===t?"w-5 bg-lime-400 shadow-[0_0_8px_rgba(166,255,0,0.6)]":"w-1.5 bg-white/30 hover:bg-white/50"),style:{transitionTimingFunction:"cubic-bezier(0.22,1,.36,1)"},m)}))},
    ]});
}
