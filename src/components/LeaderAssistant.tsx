import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  approveDecision,
  getDecision,
  getFollowups,
  getInsights,
  previewDecision,
  type DecisionResult,
} from "../lib/assistant/client";
import {
  briefText,
  whatsappUrl,
  type AssistantAnswer,
  type Followup,
  type TripBrief,
} from "../lib/assistant/domain";
import { errorMessage } from "../lib/api";
import { brand } from "../lib/brand";
import type { TravelOption } from "../lib/types";
import { formatDates, formatMoney, Notice } from "./UI";
import "./leader-assistant.css";
export default function LeaderAssistant({
  tripId,
  options,
}: {
  tripId: string;
  options: TravelOption[];
}) {
  const [open, setOpen] = useState(false),
    [answer, setAnswer] = useState<AssistantAnswer | null>(null),
    [question, setQuestion] = useState(""),
    [drafts, setDrafts] = useState<Followup[] | null>(null),
    [saved, setSaved] = useState<DecisionResult | null>(null),
    [preview, setPreview] = useState<TripBrief | null>(null),
    [selected, setSelected] = useState(options[0]?.id ?? ""),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [decisionLoaded, setDecisionLoaded] = useState(false);
  const mounted = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(label: string, job: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await job();
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy("");
    }
  }
  function loadSaved() {
    void run("Loading saved decision", async () => {
      const result = await getDecision(tripId);
      if (mounted.current) {
        setSaved(result);
        setDecisionLoaded(true);
      }
    });
  }
  function toggle() {
    setOpen(!open);
    if (!open && !decisionLoaded) loadSaved();
  }
  async function ask(e?: FormEvent) {
    e?.preventDefault();
    if (e && !question.trim()) {
      setError("Enter a question about this trip.");
      return;
    }
    await run("Preparing insights", async () => {
      const result = await getInsights(tripId, e ? question.trim() : undefined);
      if (mounted.current) setAnswer(result.answer);
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied. Review the text before sharing.");
    } catch {
      setError(
        "Copy is unavailable here. Select and copy the message manually.",
      );
    }
  }
  const shareText =
    saved?.saved && saved.brief ? briefText(saved.brief, saved.saved) : "";
  return (
    <section
      className="panel leader-assistant"
      aria-labelledby="leader-assistant-heading"
    >
      <div className="row-between">
        <div>
          <p className="section-label">
            GROUP LEADER DESK / YOU STAY IN CONTROL
          </p>
          <h2 id="leader-assistant-heading">
            A little help leading the group.
          </h2>
        </div>
        <button
          className="button"
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="leader-assistant-body"
        >
          {open ? "Close assistant" : "Open leader assistant"}
        </button>
      </div>
      <p className="quiet">
        Understand conflicts, prepare reminders, and approve a saved trip brief.
        The assistant never books, sends messages, or changes participant
        commitments.
      </p>
      {open && (
        <div id="leader-assistant-body">
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          {busy && <p role="status">{busy}…</p>}
          <section className="assistant-section">
            <div className="row-between">
              <h3>AI Group Insights</h3>
              <button
                className="button"
                disabled={Boolean(busy)}
                onClick={() => void ask()}
              >
                Explain group conflicts
              </button>
            </div>
            <form onSubmit={ask} className="assistant-question">
              <label htmlFor="leader-question">Ask {brand.name} AI</label>
              <textarea
                id="leader-question"
                rows={3}
                maxLength={500}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Why is this trip not feasible? Who still needs to confirm?"
                disabled={Boolean(busy)}
              />
              <button
                className="button button-dark"
                disabled={Boolean(busy) || !question.trim()}
              >
                Ask about this trip ↗
              </button>
              <small>
                Up to 500 characters. Only this trip’s verified facts are used.
              </small>
            </form>
            {answer && (
              <div className="assistant-answer">
                <p className="badge">
                  {answer.source === "ai"
                    ? "AI-assisted · verified evidence"
                    : "Rule-based fallback · not AI-generated"}
                </p>
                {answer.reason && <p className="quiet">{answer.reason}</p>}
                <h4>Facts from saved responses</h4>
                <ul>
                  {answer.facts.map((f) => (
                    <li key={f.id}>{f.text}</li>
                  ))}
                </ul>
                <h4>Suggestions · your decision</h4>
                <ul>
                  {answer.suggestions.map((s) => (
                    <li key={s.id}>{s.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <section className="assistant-section">
            <div className="row-between">
              <h3>Follow-ups Needed</h3>
              <button
                className="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run("Preparing reminder drafts", async () => {
                    const result = await getFollowups(tripId);
                    if (mounted.current) setDrafts(result.drafts);
                  })
                }
              >
                Generate reminder drafts
              </button>
            </div>
            <p className="quiet">
              Rule-based personalized drafts for actual named nonrespondents and
              Interested/Unsure responses. A name alone cannot match a general
              response to a personal invitation. WhatsApp opens a recipient
              chooser; nothing is sent automatically.
            </p>
            {drafts &&
              (!drafts.length ? (
                <Notice>
                  No follow-ups identified in the current saved data.
                </Notice>
              ) : (
                <ul className="followup-list">
                  {drafts.map((d) => (
                    <li key={d.id}>
                      <div className="row-between">
                        <strong>{d.name}</strong>
                        <span className="badge">{d.reason}</span>
                      </div>
                      <label>
                        <span className="sr-only">Draft for {d.name}</span>
                        <textarea
                          rows={5}
                          readOnly
                          value={d.message}
                          onFocus={(e) => e.target.select()}
                        />
                      </label>
                      <div className="hero-actions">
                        <button
                          className="button"
                          onClick={() => void copy(d.message)}
                        >
                          Copy draft for {d.name}
                        </button>
                        <a
                          className="button"
                          href={whatsappUrl(d.message)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Share draft for ${d.name} through WhatsApp`}
                        >
                          Share on WhatsApp ↗
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </section>
          <section className="assistant-section">
            <h3>Finalize Trip</h3>
            <p className="quiet">
              Select an existing saved scenario. Simulated estimates cannot be
              finalized here. Preview the current data, then explicitly approve.
              A provisional decision remains provisional.
            </p>
            {!options.length ? (
              <Notice>Add a saved travel option first.</Notice>
            ) : (
              <>
                <label htmlFor="decision-option">Saved scenario</label>
                <select
                  id="decision-option"
                  disabled={Boolean(busy)}
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setPreview(null);
                    setApproved(false);
                  }}
                >
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.destination} · {formatDates(o.start_date, o.end_date)}{" "}
                      · {formatMoney(o.estimated_cost)} / person
                    </option>
                  ))}
                </select>
                <button
                  className="button"
                  disabled={Boolean(busy) || !selected}
                  onClick={() => {
                    setPreview(null);
                    setApproved(false);
                    void run("Generating trip brief preview", async () => {
                      const result = await previewDecision(tripId, selected);
                      if (mounted.current) setPreview(result.brief);
                    });
                  }}
                >
                  Preview trip brief
                </button>
                {preview && (
                  <div className="brief-preview">
                    <h4>Preview · {preview.status}</h4>
                    <label>
                      <span className="sr-only">Trip brief preview</span>
                      <textarea readOnly rows={13} value={briefText(preview)} />
                    </label>
                    <label className="approval-check">
                      <input
                        type="checkbox"
                        checked={approved}
                        disabled={Boolean(busy)}
                        onChange={(e) => setApproved(e.target.checked)}
                      />
                      <span>
                        I have reviewed this saved scenario, its participants
                        and unresolved constraints, and approve saving this
                        decision. This does not book or charge anyone.
                      </span>
                    </label>
                    <button
                      className="button button-dark"
                      disabled={Boolean(busy) || !approved}
                      onClick={() =>
                        void run("Saving approved decision", async () => {
                          const result = await approveDecision(
                            tripId,
                            preview.optionId,
                            preview.version,
                          );
                          if (mounted.current) {
                            setSaved(result);
                            setDecisionLoaded(true);
                            setPreview(null);
                            setApproved(false);
                            setMessage(
                              "Your approved decision and brief snapshot have been saved.",
                            );
                          }
                        })
                      }
                    >
                      Approve & save decision
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          <section className="assistant-section">
            <div className="row-between">
              <h3>Trip Brief</h3>
              <button
                className="button"
                disabled={Boolean(busy)}
                onClick={loadSaved}
              >
                Refresh saved brief
              </button>
            </div>
            {!decisionLoaded ? (
              <p className="quiet">
                Load the saved decision to review its brief.
              </p>
            ) : !saved?.saved ? (
              <Notice>No approved decision saved yet.</Notice>
            ) : (
              <>
                {saved.stale && (
                  <Notice>
                    This brief is a saved snapshot. Trip data has changed since
                    approval; preview and approve again to update it. Sharing
                    this snapshot does not make it current.
                  </Notice>
                )}
                <p className="badge">
                  Leader-approved snapshot · {saved.brief?.status}
                </p>
                <label>
                  <span className="sr-only">Saved trip brief</span>
                  <textarea
                    readOnly
                    rows={15}
                    value={shareText}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <p className="quiet">
                  The brief includes participant names, budgets/constraint
                  summaries and commitments. Review it and choose recipients
                  before sharing.
                </p>
                <div className="hero-actions">
                  <button
                    className="button"
                    onClick={() => void copy(shareText)}
                  >
                    Copy trip brief
                  </button>
                  <a
                    className="button"
                    href={whatsappUrl(shareText)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Share brief on WhatsApp ↗
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
