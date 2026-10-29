import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RouteDrawing, Ticket, Wordmark } from "../components/SiteVisuals";
import { experiences } from "../data/experiences";
import { brand } from "../lib/brand";
export default function Landing() {
  const [active, setActive] = useState(experiences[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("seen");
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return (
    <>
      <Ticket />
      <section className="hero saas-hero">
        <div className="hero-copy">
          <p className="eyebrow">FOR THE ONE WHO ALWAYS PLANS THE TRIP</p>
          <h1>
            Less group chaos.
            <br />
            More <em>going.</em>
          </h1>
          <p className="hero-deck">
            {brand.tagline} Bring your people, dates, and budgets into one
            conversation — without carrying the whole group chat.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/trips/new">
              PLAN A GROUP TRIP <span>↗</span>
            </Link>
            <a className="button" href="#how-it-works">
              SEE HOW IT WORKS <span>↓</span>
            </a>
          </div>
          <p className="hero-footnote">
            One invitation. No accounts for your friends.
          </p>
        </div>
        <div className="hero-art">
          <img
            src="https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1600&q=85"
            alt="Sunlit coastline in Goa, India"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          <div className="photo-fallback" aria-hidden="true">
            <span>
              THE NEXT
              <br />
              <em>adventure.</em>
            </span>
            <small>A LITTLE CURIOSITY GOES A LONG WAY.</small>
          </div>
          <div className="image-caption">
            <span>LESS BACK-AND-FORTH</span>
            <span>MORE OUT THERE</span>
          </div>
          <div className="hero-stamp">
            GO
            <br />
            <small>
              WITH
              <br />
              YOUR PEOPLE
            </small>
          </div>
        </div>
        <div className="hero-bottom">
          <div className="hero-meta">
            <span>01 — CREATE A TRIP</span>
            <span>02 — INVITE YOUR PEOPLE</span>
            <span>03 — FIND COMMON GROUND</span>
          </div>
          <Wordmark />
        </div>
      </section>
      <section id="how-it-works" className="section-pad product-steps">
        <div className="section-index">
          <span>A GOOD PLAN STARTS WITH PEOPLE</span>
          <span>01 / HOW IT WORKS</span>
        </div>
        <div className="discover-intro">
          <h2>
            Your group.
            <br />
            On the <em>same page.</em>
          </h2>
          <div className="discover-copy">
            <p>
              You shouldn’t need twenty messages to learn who’s free. Give
              everyone a simple way to tell you what works, and keep the
              decisions in your hands.
            </p>
          </div>
        </div>
        <div className="steps-grid">
          {[
            [
              "01",
              "Put a plan out there.",
              "Add destinations, dates, estimated costs, and a minimum group size. Start with possibilities, not a perfect itinerary.",
            ],
            [
              "02",
              "Let everyone weigh in.",
              "Share a link. Friends send their availability, budget, interests, and commitment — no sign-up required.",
            ],
            [
              "03",
              "See the whole picture.",
              "Get every response in your private group dashboard. See who has replied and what your people have in mind.",
            ],
          ].map(([n, title, text]) => (
            <article className="panel" key={n}>
              <p className="eyebrow">{n} / THE NEXT STEP</p>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="hero-actions">
          <Link className="button button-dark" to="/trips/new">
            CREATE YOUR FIRST TRIP <span>↗</span>
          </Link>
        </div>
      </section>
      <section id="inspiration" className="experiences section-pad">
        <div className="section-index">
          <span>KEEP A LITTLE CURIOSITY</span>
          <span>02 / TRAVEL INSPIRATION</span>
        </div>
        <h2 className="experience-heading">
          A shared trip.
          <br />A thousand <em>possibilities.</em>
        </h2>
        <div className="experience-note">
          <span>ILLUSTRATIVE ROUTES · NOT LIVE TRIP DATA</span>
          <p>A little inspiration before you make it your own.</p>
        </div>
        <div
          className="experience-tabs"
          role="group"
          aria-label="Choose a trip experience"
        >
          {experiences.map((item) => (
            <button
              key={item.id}
              aria-pressed={active.id === item.id}
              className={active.id === item.id ? "active" : ""}
              onClick={() => setActive(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <RouteDrawing active={active} />
      </section>
      <section className="closing section-pad">
        <div className="section-index">
          <span>YOUR PEOPLE. YOUR POSSIBILITIES.</span>
          <span>03 / MAKE IT HAPPEN</span>
        </div>
        <div className="closing-content">
          <p className="eyebrow">YOU LEAD. EVERYONE HAS A VOICE.</p>
          <h2>
            The next great trip
            <br />
            starts with
            <br />
            <em>an invitation.</em>
          </h2>
          <div className="hero-actions">
            <Link className="button button-dark" to="/trips/new">
              LET’S GET THE GROUP GOING <span>↗</span>
            </Link>
          </div>
        </div>
      </section>
      <footer className="footer">
        <div className="footer-note">
          <span>{brand.tagline}</span>
          <Link to="/trips">YOUR TRIPS ↗</Link>
        </div>
        <Wordmark footer />
      </footer>
    </>
  );
}
