import { useMemo, useState } from "react";
import type { ParticipantResponse, TravelOption } from "../lib/types";
import {
  evaluateFeasibility,
  simulateOption,
  suggestCompromises,
  type CompromiseSuggestion,
  type OptionEvaluation,
  type ParticipantEvaluation,
} from "../lib/feasibility";
import { money } from "../lib/validation";
import { formatDates, formatMoney, Notice } from "./UI";
import "./feasibility.css";

const names = (people: ParticipantEvaluation[]) =>
  people.map((p) => p.name).join(", ") || "None";
function Status({ result }: { result: OptionEvaluation }) {
  return (
    <span
      className={`badge feasibility-${result.status.toLowerCase().replace(" ", "-")}`}
    >
      {result.status}
    </span>
  );
}
function Explanation({ result }: { result: OptionEvaluation }) {
  return (
    <p className="feasibility-explanation">
      {result.status === "Ready"
        ? `Confirmed eligible participants: ${result.confirmed.length}. Both date and budget constraints are met, and the minimum of ${result.minimum} is reached.`
        : result.status === "Potential"
          ? `Eligible participants: ${result.confirmed.length} confirmed, ${result.interested.length} interested, and ${result.unsure.length} unsure. At least ${result.confirmationsNeeded} additional confirmations are needed to reach ${result.minimum}.`
          : `Eligible participants: ${result.eligibleCount}. Even if everyone eligible confirms, the minimum of ${result.minimum} is short by ${result.additionalPeopleNeeded}.`}
    </p>
  );
}
function ParticipantDetails({ result }: { result: OptionEvaluation }) {
  return (
    <details className="feasibility-people">
      <summary>
        Who fits, and who doesn’t? ({result.participants.length} valid
        responses)
      </summary>
      <dl className="feasibility-roster">
        <div>
          <dt>Confirmed · {result.confirmed.length}</dt>
          <dd>{names(result.confirmed)}</dd>
        </div>
        <div>
          <dt>Interested · {result.interested.length}</dt>
          <dd>{names(result.interested)}</dd>
        </div>
        <div>
          <dt>Unsure · {result.unsure.length}</dt>
          <dd>{names(result.unsure)}</dd>
        </div>
        <div>
          <dt>Excluded by hard constraints · {result.excluded.length}</dt>
          <dd>
            {result.excluded.length ? (
              <ul>
                {result.excluded.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong> —{" "}
                    {p.reasons
                      .map((reason) =>
                        reason === "dates"
                          ? "Dates not selected"
                          : `Budget ${formatMoney(p.budget)} is below ${formatMoney(result.option.estimated_cost)}`,
                      )
                      .join("; ")}
                  </li>
                ))}
              </ul>
            ) : (
              "None"
            )}
          </dd>
        </div>
        <div>
          <dt>Destination preference · soft</dt>
          <dd>
            {result.preferenceCount} of {result.eligibleCount} eligible people
            prefer {result.option.destination}. A different preference does not
            exclude anyone.
          </dd>
        </div>
      </dl>
    </details>
  );
}
function Suggestion({ suggestion: s }: { suggestion: CompromiseSuggestion }) {
  if (s.kind === "confirmation")
    return (
      <>
        <h4>
          {s.to.status === "Potential"
            ? "A little more commitment."
            : "This option still needs people."}
        </h4>
        <p>
          For {s.to.option.destination} (
          {formatDates(s.to.option.start_date, s.to.option.end_date)}):{" "}
          {s.to.status === "Potential"
            ? `${s.to.confirmationsNeeded} more confirmations are needed from the ${s.to.interested.length + s.to.unsure.length} interested or unsure people who already meet date and budget constraints.`
            : `even if all ${s.to.eligibleCount} currently eligible people confirm, ${s.to.additionalPeopleNeeded} additional eligible responses are needed to reach the minimum of ${s.to.minimum}.`}
        </p>
      </>
    );
  return (
    <>
      <h4>
        {s.kind === "dates"
          ? "Another proposed date fits more confirmed people."
          : "A saved lower-cost option includes more people."}
      </h4>
      <p>
        {s.kind === "dates"
          ? `${s.to.option.destination}: ${formatDates(s.to.option.start_date, s.to.option.end_date)} fits ${s.to.confirmed.length} confirmed people, versus ${s.from.confirmed.length} on ${formatDates(s.from.option.start_date, s.from.option.end_date)}. Both saved options cost ${formatMoney(s.to.option.estimated_cost)} per person.`
          : `${s.to.option.destination} at ${formatMoney(s.to.option.estimated_cost)} fits ${s.to.eligibleCount} people, versus ${s.from.option.destination} at ${formatMoney(s.from.option.estimated_cost)} with ${s.from.eligibleCount}. Both use ${formatDates(s.to.option.start_date, s.to.option.end_date)}.`}
      </p>
      <p className="quiet">
        Newly eligible: {names(s.gained)}. No longer eligible: {names(s.lost)}.
        {s.kind === "budget" &&
        s.to.option.destination !== s.from.option.destination
          ? " The destination also changes; review the group’s soft preferences."
          : ""}{" "}
        More eligible people does not guarantee more confirmations.
      </p>
    </>
  );
}
export default function FeasibilityPanel({
  options,
  responses,
  minimum,
}: {
  options: TravelOption[];
  responses: ParticipantResponse[];
  minimum: number;
}) {
  const analysis = useMemo(() => {
    try {
      return {
        report: evaluateFeasibility(options, responses, minimum),
        error: "",
      };
    } catch (e) {
      return {
        report: null,
        error:
          e instanceof Error
            ? e.message
            : "Unable to evaluate these trip details.",
      };
    }
  }, [options, responses, minimum]);
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
  const [costOverride, setCostOverride] = useState<string | null>(null);
  const [minimumOverride, setMinimumOverride] = useState<string | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const report = analysis.report;
  const selected =
    report?.ranked.find((r) => r.option.id === selectedId) ?? report?.ranked[0];
  const costText =
    costOverride ?? String(selected?.option.estimated_cost ?? "");
  const minimumText = minimumOverride ?? String(minimum);
  const cost = costText.trim() === "" ? NaN : Number(costText);
  const simulatedMinimum =
    minimumText.trim() === "" ? NaN : Number(minimumText);
  const costError = money(cost)
    ? ""
    : "Enter an INR estimate from 0 to 100,000,000, with at most two decimal places.";
  const minimumError =
    Number.isInteger(simulatedMinimum) &&
    simulatedMinimum >= 2 &&
    simulatedMinimum <= 1000
      ? ""
      : "Choose a whole-number minimum between 2 and 1,000.";
  const simulated = useMemo(
    () =>
      selected && !costError && !minimumError
        ? simulateOption(
            options,
            responses,
            selected.option.id,
            cost,
            simulatedMinimum,
          )
        : null,
    [
      selected,
      options,
      responses,
      cost,
      simulatedMinimum,
      costError,
      minimumError,
    ],
  );
  if (!report)
    return (
      <section className="panel feasibility-panel">
        <h2>Group feasibility</h2>
        <Notice error>{analysis.error}</Notice>
      </section>
    );
  const suggestions = suggestCompromises(report);
  const gained =
    selected && simulated
      ? simulated.participants.filter(
          (p) =>
            !p.reasons.length && selected.excluded.some((x) => x.id === p.id),
        )
      : [];
  const lost =
    selected && simulated
      ? simulated.excluded.filter((p) =>
          selected.participants.some((x) => x.id === p.id && !x.reasons.length),
        )
      : [];
  return (
    <section
      className="panel feasibility-panel"
      aria-labelledby="feasibility-heading"
    >
      <div className="row-between">
        <div>
          <div className="section-label">
            GROUP FEASIBILITY / SAVED RESPONSES
          </div>
          <h2 id="feasibility-heading">Find a plan that fits.</h2>
        </div>
        <span className="badge">
          {report.participantCount} valid responses · minimum {minimum}
        </span>
      </div>
      <p className="quiet">
        Dates and budgets are hard constraints. Destination preferences help
        rank options but never exclude someone. Only saved responses count; the
        organizer is not automatically included. Ready describes preferences,
        not a booking or payment.
      </p>
      <details className="ranking-rules">
        <summary>How are options ranked?</summary>
        <ol>
          <li>Minimum group reached by confirmed eligible people (Ready).</li>
          <li>
            More confirmed eligible people, then more interested eligible
            people.
          </li>
          <li>Higher share of eligible people who prefer the destination.</li>
          <li>
            Higher share of date-available people who can afford it, then lower
            cost.
          </li>
          <li>
            Exact ties: earlier departure, earlier return, destination, then
            option ID.
          </li>
        </ol>
        <p>
          Unsure people can make an option Potential, but never Ready. A higher
          confirmed headcount takes priority over potential reach. Availability
          transfers only between options with identical date ranges; overlapping
          dates alone do not count.
        </p>
      </details>
      {report.issues.length > 0 && (
        <details className="feasibility-issues">
          <summary>
            {report.issues.length} data issue
            {report.issues.length === 1 ? "" : "s"} handled — review before
            deciding
          </summary>
          <ul>
            {report.issues.map((issue, i) => (
              <li key={`${issue.kind}-${issue.id}-${i}`}>
                {issue.message}
                {issue.id ? ` (${issue.id})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!options.length ? (
        <Notice>Add travel options to evaluate the group.</Notice>
      ) : !report.ranked.length ? (
        <Notice error>
          No valid travel options are available to evaluate.
        </Notice>
      ) : (
        <>
          {!report.participantCount && (
            <Notice>
              No valid responses yet. Share the invitation to start evaluating
              real preferences. No option is Ready or Potential without enough
              eligible responses.
            </Notice>
          )}
          <ol
            className="feasibility-ranking"
            aria-label="Ranked saved trip options"
          >
            {report.ranked.map((result, i) => (
              <li key={result.option.id}>
                <article
                  className="feasibility-option"
                  aria-label={`Rank ${i + 1}: ${result.option.destination}`}
                >
                  <div className="row-between">
                    <p className="eyebrow">
                      RANK {String(i + 1).padStart(2, "0")} · SAVED OPTION
                    </p>
                    <Status result={result} />
                  </div>
                  <h3>{result.option.destination}</h3>
                  <div className="feasibility-option-meta">
                    <span>
                      {formatDates(
                        result.option.start_date,
                        result.option.end_date,
                      )}
                    </span>
                    <strong>
                      {formatMoney(result.option.estimated_cost)} / person,
                      estimated
                    </strong>
                  </div>
                  <div className="feasibility-counts">
                    <span>
                      <b>{result.confirmed.length}</b> confirmed
                    </span>
                    <span>
                      <b>{result.interested.length}</b> interested
                    </span>
                    <span>
                      <b>{result.unsure.length}</b> unsure
                    </span>
                    <span>
                      <b>{result.excluded.length}</b> excluded
                    </span>
                  </div>
                  <Explanation result={result} />
                  <p className="quiet">
                    Preference alignment: {result.preferenceCount} of{" "}
                    {result.eligibleCount} eligible people. Affordability:{" "}
                    {result.eligibleCount} of {result.dateAvailableCount}{" "}
                    date-available people meet the budget.
                  </p>
                  <ParticipantDetails result={result} />
                </article>
              </li>
            ))}
          </ol>
          {suggestions.length > 0 && (
            <div className="compromise-section">
              <h3>A few ways forward.</h3>
              <p className="quiet">
                Comparisons use only saved options and responses. The group
                leader decides.
              </p>
              <ul>
                {suggestions.map((s) => (
                  <li key={s.kind}>
                    <Suggestion suggestion={s} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="what-if">
            <div className="row-between">
              <div>
                <p className="eyebrow">PRIVATE SANDBOX · NEVER SAVED</p>
                <h3>What if the plan changed?</h3>
              </div>
              <button
                type="button"
                className="button"
                aria-expanded={simulatorOpen}
                aria-controls="what-if-controls"
                onClick={() => setSimulatorOpen(!simulatorOpen)}
              >
                {simulatorOpen ? "Close simulator" : "Explore what-if"}
              </button>
            </div>
            <p className="quiet">
              Try an existing option with a different estimate or group minimum.
              Simulated prices are hypothetical, not quotes. Your saved rankings
              and participant responses stay unchanged.
            </p>
            {simulatorOpen && (
              <div id="what-if-controls">
                <div className="simulation-fields">
                  <label htmlFor="simulation-option">
                    Existing travel option
                  </label>
                  <select
                    id="simulation-option"
                    value={selected?.option.id ?? ""}
                    onChange={(e) => {
                      setSelectedId(e.target.value);
                      setCostOverride(null);
                    }}
                  >
                    {report.ranked.map((r) => (
                      <option key={r.option.id} value={r.option.id}>
                        {r.option.destination} ·{" "}
                        {formatDates(r.option.start_date, r.option.end_date)} ·{" "}
                        {formatMoney(r.option.estimated_cost)} saved
                      </option>
                    ))}
                  </select>
                  <div className="field-grid">
                    <label>
                      Simulated cost per person · INR
                      <input
                        type="number"
                        min={0}
                        max={100000000}
                        step="0.01"
                        inputMode="decimal"
                        value={costText}
                        aria-invalid={Boolean(costError)}
                        aria-describedby={
                          costError ? "simulation-cost-error" : "saved-estimate"
                        }
                        onChange={(e) => setCostOverride(e.target.value)}
                      />
                    </label>
                    <label>
                      Simulated minimum group size
                      <input
                        type="number"
                        min={2}
                        max={1000}
                        step={1}
                        value={minimumText}
                        aria-invalid={Boolean(minimumError)}
                        aria-describedby={
                          minimumError ? "simulation-minimum-error" : undefined
                        }
                        onChange={(e) => setMinimumOverride(e.target.value)}
                      />
                    </label>
                  </div>
                  {costError && (
                    <p
                      role="alert"
                      className="field-error"
                      id="simulation-cost-error"
                    >
                      {costError}
                    </p>
                  )}
                  {minimumError && (
                    <p
                      role="alert"
                      className="field-error"
                      id="simulation-minimum-error"
                    >
                      {minimumError}
                    </p>
                  )}
                  <p className="quiet" id="saved-estimate">
                    Saved estimate:{" "}
                    {formatMoney(selected!.option.estimated_cost)} per person.
                    Saved minimum: {minimum}.
                  </p>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setSelectedId(options[0]?.id ?? "");
                      setCostOverride(null);
                      setMinimumOverride(null);
                    }}
                  >
                    Reset to saved values
                  </button>
                </div>
                {simulated && selected && (
                  <div
                    className="simulation-result"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <div className="row-between">
                      <strong>
                        SIMULATED RESULT · {formatMoney(cost)} / person ·
                        minimum {simulatedMinimum}
                      </strong>
                      <Status result={simulated} />
                    </div>
                    <p>
                      {simulated.confirmed.length} confirmed ·{" "}
                      {simulated.interested.length} interested ·{" "}
                      {simulated.unsure.length} unsure ·{" "}
                      {simulated.excluded.length} excluded
                    </p>
                    <Explanation result={simulated} />
                    <p>
                      Eligible people: {selected.eligibleCount} saved →{" "}
                      {simulated.eligibleCount} simulated. Status:{" "}
                      {selected.status} saved → {simulated.status} simulated.
                    </p>
                    <p>
                      Newly eligible: {names(gained)}. No longer eligible:{" "}
                      {names(lost)}.
                    </p>
                    <p className="quiet">
                      Changing the minimum does not change anyone’s eligibility
                      or commitment. Estimates still need real-world
                      verification.
                    </p>
                    <ParticipantDetails result={simulated} />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
