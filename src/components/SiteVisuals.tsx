import { useEffect, useRef, useState } from "react";
import { experiences } from "../data/experiences";
import { brand } from "../lib/brand";

export function Wordmark({ footer = false }: { footer?: boolean }) {
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    const fn = () => setScroll(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const letters = brand.wordmark.split("");
  return (
    <div
      className={`wordmark ${footer ? "wordmark-footer" : ""}`}
      aria-label={brand.wordmark}
    >
      {letters.map((l, i) => (
        <span
          key={i}
          style={{
            transform: `translateY(${Math.abs(i - 5) * Math.min(scroll / 300, 1.6) * 2}px)`,
            letterSpacing: `${Math.min(scroll / 450, 1) * 0.12}em`,
          }}
        >
          {l}
        </span>
      ))}
    </div>
  );
}
export function Ticket() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const update = () => {
      if (!ref.current) return;
      const p = Math.min(window.scrollY / 2100, 1),
        stops = [
          { x: 77, y: 32, r: 7, s: 1, o: 1 },
          { x: 9, y: 44, r: -8, s: 0.92, o: 1 },
          { x: 76, y: 48, r: 6, s: 0.88, o: 1 },
          { x: 17, y: 42, r: -5, s: 0.8, o: 1 },
          { x: 76, y: 65, r: 3, s: 0.7, o: 0 },
        ],
        q = p * (stops.length - 1),
        a = Math.floor(q),
        b = Math.min(a + 1, stops.length - 1),
        t = q - a;
      const v = (k: keyof (typeof stops)[0]) =>
        stops[a][k] * (1 - t) + stops[b][k] * t;
      ref.current.style.setProperty("--tx", `${v("x")}%`);
      ref.current.style.setProperty("--ty", `${v("y")}vh`);
      ref.current.style.setProperty("--rot", `${v("r")}deg`);
      ref.current.style.setProperty("--scale", `${v("s")}`);
      ref.current.style.setProperty("--opacity", `${v("o")}`);
      ref.current.style.visibility = v("o") < 0.01 ? "hidden" : "visible";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <aside className="ticket" ref={ref} aria-hidden="true">
      <div className="ticket-top">
        <span>{brand.wordmark}</span>
        <span>INDIA</span>
      </div>
      <div className="ticket-mid">
        <b>TT / 028</b>
        <svg viewBox="0 0 120 38">
          <path d="M3 30 C24 4 36 35 55 17 S82 8 117 4" />
          <circle cx="3" cy="30" r="2" />
          <circle cx="117" cy="4" r="2" />
        </svg>
      </div>
      <div className="ticket-bottom">
        <span>DEL—JAI—GOA</span>
        <span>NO. 004281</span>
      </div>
      <div className="ticket-perf" />
    </aside>
  );
}
export function RouteDrawing({
  active,
}: {
  active: (typeof experiences)[number];
}) {
  const pathRef = useRef<SVGPathElement>(null),
    panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      path.style.strokeDashoffset = "0";
      return;
    }
    const obs = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) {
          path.style.transition =
            "stroke-dashoffset 2s cubic-bezier(.2,.7,.2,1)";
          path.style.strokeDashoffset = "0";
        } else {
          path.style.transition = "none";
          path.style.strokeDashoffset = `${len}`;
        }
      },
      { threshold: 0.25 },
    );
    if (panelRef.current) obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, [active]);
  return (
    <div className="route-panel" ref={panelRef}>
      <div className="route-label">
        A ROUTE TAKES SHAPE <span>DRAWN TO GO</span>
      </div>
      <svg
        className="route-svg"
        viewBox="0 0 760 310"
        role="img"
        aria-label={`${active.route.join(" to ")} illustrative travel route`}
      >
        <path ref={pathRef} d={active.path} />
        {[75, 370, 690].map((x, i) => (
          <g
            key={i}
            className="route-stop"
            transform={`translate(${x} ${i === 0 ? (active.id === "nature" || active.id === "wellness" ? 104 : 245) : i === 2 ? 88 : 174})`}
          >
            <circle r="5" />
            <text y="25" textAnchor="middle">
              {active.route[i]}
            </text>
          </g>
        ))}
      </svg>
      <div className="route-legend">
        <span>01 / START</span>
        <span>→</span>
        <span>03 / FOLLOW THE LINE</span>
      </div>
      <p className="route-description">{active.description}</p>
      <div className="route-facts">
        <div>
          <b>{active.stops}</b>
          <small>STOPS</small>
        </div>
        <div>
          <b>{active.days}</b>
          <small>DURATION</small>
        </div>
        <div>
          <b>{active.note}</b>
          <small>TRIP CONFIGURATION</small>
        </div>
      </div>
    </div>
  );
}
