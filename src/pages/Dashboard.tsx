import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addInvitees,
  errorMessage,
  invitationUrl,
  loadDashboard,
} from "../lib/api";
import type { Dashboard as DashboardData } from "../lib/types";
import { brand } from "../lib/brand";
import {
  formatDates,
  formatMoney,
  Notice,
  PageHeading,
} from "../components/UI";
export default function Dashboard() {
  const { id = "" } = useParams();
  const [data, setData] = useState<DashboardData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [copied, setCopied] = useState(""),
    [names, setNames] = useState(""),
    [adding, setAdding] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setData(null);
    loadDashboard(id)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, attempt]);
  async function copy(text: string, label: string) {
    setCopied("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setError(
        "Copy is unavailable in this browser. Select the invitation link or message and copy it manually.",
      );
    }
  }
  async function share() {
    if (!data) return;
    const url = invitationUrl(data.trip.invitation_token);
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.trip.name,
          text: `Help shape our trip on ${brand.name}.`,
          url,
        });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setError(errorMessage(e));
      }
    } else await copy(url, "Invitation link copied.");
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    if (adding) return;
    setError("");
    const list = names
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);
    if (
      !list.length ||
      list.length > 100 ||
      list.some((n) => n.length > 120) ||
      new Set(list.map((n) => n.toLowerCase())).size !== list.length
    ) {
      setError(
        "Enter 1 to 100 distinct names, one per line, up to 120 characters each.",
      );
      return;
    }
    setAdding(true);
    try {
      await addInvitees(id, list);
      setNames("");
      setAttempt((x) => x + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  }
  if (loading)
    return (
      <div className="workspace">
        <Notice>Loading your group’s responses…</Notice>
      </div>
    );
  if (!data)
    return (
      <div className="workspace">
        <PageHeading kicker="GROUP LEADER DESK" title="Trip unavailable." />
        <Notice error>
          {error || "This trip does not exist or belongs to another organizer."}
        </Notice>
        <div className="hero-actions">
          <button className="button" onClick={() => setAttempt(attempt + 1)}>
            Try again
          </button>
          <Link className="button" to="/trips">
            My trips
          </Link>
        </div>
      </div>
    );
  const { trip, options, responses, invitees } = data;
  const url = invitationUrl(trip.invitation_token);
  const message = `You’re invited to ${trip.name}! ${trip.description ? trip.description + " " : ""}Tell us your dates, budget, and travel preferences on ${brand.name}. No account needed. ${url}`;
  const responded = new Set(
    responses.map((r) => r.invitation_id).filter(Boolean),
  );
  const matched = invitees.filter((i) => responded.has(i.id)).length;
  const confirmed = responses.filter(
    (r) => r.commitment === "Confirmed",
  ).length;
  return (
    <div className="workspace dashboard">
      <Link className="back-link" to="/trips">
        ← All trips
      </Link>
      <div className="heading-actions">
        <PageHeading kicker="GROUP LEADER DESK" title={trip.name}>
          {trip.description || "Your next shared adventure, taking shape."}
        </PageHeading>
        <button className="button" onClick={() => setAttempt(attempt + 1)}>
          Refresh responses ↻
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {copied && <Notice>{copied}</Notice>}
      <div className="stats-grid">
        <div>
          <span>RESPONSES</span>
          <strong>{responses.length}</strong>
          <small>People who have weighed in</small>
        </div>
        <div>
          <span>CONFIRMED</span>
          <strong>{confirmed}</strong>
          <small>Self-reported commitment</small>
        </div>
        <div>
          <span>MINIMUM GROUP</span>
          <strong>{trip.minimum_participants}</strong>
          <small>Planning target, including you</small>
        </div>
        <div>
          <span>TRAVEL OPTIONS</span>
          <strong>{options.length}</strong>
          <small>Possibilities to consider</small>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-label">01 / BRING YOUR PEOPLE IN</div>
          <h2>Pass the invitation.</h2>
          <p className="quiet">
            Anyone with this link can submit their own preferences. It never
            opens your dashboard or other people’s responses.
          </p>
          <label>
            General invitation link
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="hero-actions">
            <button className="button button-dark" onClick={share}>
              Share invitation ↗
            </button>
            <button
              className="button"
              onClick={() => copy(url, "Invitation link copied.")}
            >
              Copy link
            </button>
          </div>
          <details>
            <summary>WhatsApp invitation message</summary>
            <label className="sr-only" htmlFor="whatsapp-message">
              Invitation message for WhatsApp
            </label>
            <textarea
              id="whatsapp-message"
              readOnly
              rows={5}
              value={message}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="button"
              onClick={() =>
                copy(
                  message,
                  "WhatsApp message copied. Paste it into your group chat.",
                )
              }
            >
              Copy WhatsApp message
            </button>
          </details>
        </section>
        <section className="panel">
          <div className="section-label">02 / RESPONSE PROGRESS</div>
          <h2>The group, so far.</h2>
          {invitees.length ? (
            <>
              <p>
                {matched} of {invitees.length} named invitations have a
                response.
              </p>
              <progress
                max={invitees.length}
                value={matched}
                aria-label="Named invitation response progress"
              />
              <p className="quiet">
                {responses.length - matched} additional response
                {responses.length - matched === 1 ? "" : "s"} through the
                general link. General-link responses are not matched by name.
              </p>
            </>
          ) : (
            <>
              <p>
                {responses.length} response{responses.length === 1 ? "" : "s"}{" "}
                collected.
              </p>
              <p className="quiet">
                No invitation list yet, so there’s no expected response total.
                Add names below to track personal invitations.
              </p>
            </>
          )}
          <p className="quiet">
            The group minimum is a target, not a feasibility score. Confirmed
            does not imply payment or a booking.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="section-label">03 / OPTIONS ON THE TABLE</div>
        <h2>A few ways to go.</h2>
        <div className="option-grid">
          {options.map((o, i) => (
            <article className="option-summary" key={o.id}>
              <p className="eyebrow">OPTION {String(i + 1).padStart(2, "0")}</p>
              <h3>{o.destination}</h3>
              <p>{formatDates(o.start_date, o.end_date)}</p>
              <strong>
                {formatMoney(o.estimated_cost)}{" "}
                <small>/ person, estimated</small>
              </strong>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="row-between">
          <div>
            <div className="section-label">04 / EVERY VOICE MATTERS</div>
            <h2>What your people said.</h2>
          </div>
          <span className="badge">{responses.length} responses</span>
        </div>
        {!responses.length ? (
          <div className="inline-empty">
            <p>
              No responses yet. Share the invitation to get the conversation
              started.
            </p>
          </div>
        ) : (
          <div className="responses">
            {responses.map((r) => (
              <article className="response-card" key={r.id}>
                <div className="row-between">
                  <h3>{r.name}</h3>
                  <span
                    className={`badge status-${r.commitment.toLowerCase()}`}
                  >
                    {r.commitment}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Maximum budget</dt>
                    <dd>{formatMoney(r.max_budget)}</dd>
                  </div>
                  <div>
                    <dt>Preferred destinations</dt>
                    <dd>{r.preferred_destinations.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Available travel options</dt>
                    <dd>
                      {r.available_option_ids
                        .map((optionId) => {
                          const o = options.find((x) => x.id === optionId);
                          return o
                            ? `${o.destination} · ${formatDates(o.start_date, o.end_date)}`
                            : "Unavailable option";
                        })
                        .join("; ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Travel interests</dt>
                    <dd>{r.interests.join(" · ")}</dd>
                  </div>
                </dl>
                <small className="quiet">
                  Updated {new Date(r.updated_at).toLocaleString("en-IN")}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-label">05 / PERSONAL INVITATIONS</div>
        <h2>Leave no friend guessing.</h2>
        <p className="quiet">
          Add the people you actually intend to invite. Send each person their
          own link to track a response. These links don’t verify identity; share
          them privately. Their private response-edit link is separate.
        </p>
        {invitees.length > 0 && (
          <ul className="invitation-list">
            {invitees.map((i) => (
              <li key={i.id}>
                <div className="row-between">
                  <strong>{i.name}</strong>
                  <span className="badge">
                    {responded.has(i.id) ? "Responded" : "Awaiting response"}
                  </span>
                </div>
                <label>
                  <span className="sr-only">Invitation for {i.name}</span>
                  <input
                    readOnly
                    value={invitationUrl(i.token)}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() =>
                    copy(
                      invitationUrl(i.token),
                      `Personal link for ${i.name} copied.`,
                    )
                  }
                >
                  Copy personal link ↗
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="form-stack add-invitees" onSubmit={invite}>
          <label>
            Add names · one per line
            <textarea
              required
              rows={3}
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder={"Aarav Sharma\nMaya Rao"}
              disabled={adding}
            />
          </label>
          <button
            className="button"
            disabled={adding || invitees.length >= 100}
          >
            {adding ? "Adding…" : "+ Add to invitation list"}
          </button>
          <small className="quiet">
            Up to 100 named invitations per trip. Names must be distinct.
          </small>
        </form>
      </section>
    </div>
  );
}
