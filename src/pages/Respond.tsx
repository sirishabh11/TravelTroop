import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  errorMessage,
  loadInvitation,
  ownResponse,
  saveResponse,
  invitationUrl,
} from "../lib/api";
import {
  interests,
  type Errors,
  type Invitation,
  type ResponseInput,
} from "../lib/types";
import { validateResponse } from "../lib/validation";
import {
  BackendGate,
  FieldError,
  formatDates,
  formatMoney,
  Notice,
  PageHeading,
} from "../components/UI";
import { configured } from "../lib/supabase";
const initial: ResponseInput = {
  name: "",
  available_option_ids: [],
  max_budget: NaN,
  preferred_destinations: [],
  interests: [],
  commitment: "Interested",
  invitation_id: null,
};
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((x) => x !== value)
    : [...values, value];
export default function Respond() {
  const { token = "" } = useParams();
  const location = useLocation();
  const editToken = new URLSearchParams(location.hash.slice(1)).get("edit");
  const [trip, setTrip] = useState<Invitation | null>(null),
    [input, setInput] = useState<ResponseInput>(initial),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Errors>({}),
    [saved, setSaved] = useState<string | null>(null),
    [copied, setCopied] = useState(false),
    [attempt, setAttempt] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let live = true;
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setTrip(null);
    setSaved(null);
    setInput(initial);
    Promise.all([
      loadInvitation(token),
      editToken ? ownResponse(editToken) : Promise.resolve(null),
    ])
      .then(([data, response]) => {
        if (live) {
          setTrip(data);
          setInput(
            response ?? {
              ...initial,
              name: data.invited_name ?? "",
              invitation_id: data.invitation_id ?? null,
            },
          );
        }
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
  }, [token, editToken, attempt]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trip || busy) return;
    setError("");
    const invalid = validateResponse(input, trip.options);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    setBusy(true);
    try {
      const secret = await saveResponse(
        token,
        { ...input, name: input.name.trim() },
        editToken,
      );
      setSaved(secret);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const attrs = (key: string) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `error-${key}` : undefined,
  });
  const privateLink = saved ? `${invitationUrl(token)}#edit=${saved}` : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(privateLink);
      setCopied(true);
    } catch {
      setCopied(false);
      setError(
        "Copy is unavailable here. Select and copy the private link below.",
      );
    }
  }
  return (
    <div className="workspace form-width">
      <BackendGate>
        {loading ? (
          <Notice>Opening your invitation…</Notice>
        ) : !trip ? (
          <>
            <PageHeading kicker="INVITATION" title="Let’s find your trip." />
            {error && <Notice error>{error}</Notice>}
            <button className="button" onClick={() => setAttempt(attempt + 1)}>
              Try again
            </button>
          </>
        ) : saved ? (
          <div className="panel success-state">
            <p className="eyebrow">RESPONSE SAVED</p>
            <h1>You’re in the conversation.</h1>
            <p>
              Your preferences for <strong>{trip.name}</strong> have been saved.
              Your group leader can now see them.
            </p>
            <Notice>
              Keep this private edit link. It is the only way to update your
              response without an account. Anyone with it can view and change
              your response. Share only the original invitation with friends.
            </Notice>
            <label>
              Your private edit link
              <input
                readOnly
                value={privateLink}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="hero-actions">
              <button
                type="button"
                className="button button-dark"
                onClick={copy}
              >
                {copied ? "Copied ✓" : "Copy private edit link"}
              </button>
              <a className="button" href={privateLink}>
                Update my response ↗
              </a>
            </div>
            {error && <Notice error>{error}</Notice>}
          </div>
        ) : (
          <>
            <PageHeading
              kicker={
                editToken
                  ? "YOUR PRIVATE RESPONSE"
                  : "YOU’RE INVITED · NO ACCOUNT NEEDED"
              }
              title={trip.name}
            >
              {trip.description ||
                "A shared adventure is taking shape. Tell your group leader what works for you."}
            </PageHeading>
            <div className="invitation-summary">
              <span>Minimum group · {trip.minimum_participants}</span>
              <span>
                {trip.options.length} travel option
                {trip.options.length === 1 ? "" : "s"}
              </span>
              <span>All budgets in INR</span>
            </div>
            <form
              ref={form}
              onSubmit={submit}
              className="form-stack"
              noValidate
            >
              <fieldset className="panel" disabled={busy}>
                <legend>A little about you</legend>
                <label>
                  Your name
                  <input
                    {...attrs("name")}
                    required
                    maxLength={120}
                    autoComplete="name"
                    value={input.name}
                    onChange={(e) =>
                      setInput({ ...input, name: e.target.value })
                    }
                  />
                  <FieldError id="error-name" message={errors.name} />
                </label>
                <fieldset className="choice-set">
                  <legend>
                    Which travel options can you make?{" "}
                    <small>Choose all that work.</small>
                  </legend>
                  {trip.options.map((o) => (
                    <label className="choice-card" key={o.id}>
                      <input
                        {...attrs("available_option_ids")}
                        type="checkbox"
                        checked={input.available_option_ids.includes(o.id)}
                        onChange={() =>
                          setInput({
                            ...input,
                            available_option_ids: toggle(
                              input.available_option_ids,
                              o.id,
                            ),
                          })
                        }
                      />
                      <span>
                        <strong>{o.destination}</strong>
                        <span>{formatDates(o.start_date, o.end_date)}</span>
                        <small>
                          Estimated {formatMoney(o.estimated_cost)} / person
                        </small>
                      </span>
                    </label>
                  ))}
                  <FieldError
                    id="error-available_option_ids"
                    message={errors.available_option_ids}
                  />
                </fieldset>
                <label>
                  Your maximum per-person budget · INR
                  <input
                    {...attrs("max_budget")}
                    required
                    type="number"
                    min={0}
                    max={100000000}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="15000"
                    value={
                      Number.isNaN(input.max_budget) ? "" : input.max_budget
                    }
                    onChange={(e) =>
                      setInput({ ...input, max_budget: e.target.valueAsNumber })
                    }
                  />
                  <small>
                    Your honest ceiling helps your leader understand what works.
                  </small>
                  <FieldError
                    id="error-max_budget"
                    message={errors.max_budget}
                  />
                </label>
                <fieldset className="choice-set">
                  <legend>Where would you love to go?</legend>
                  <div className="choice-pills">
                    {[...new Set(trip.options.map((o) => o.destination))].map(
                      (d) => (
                        <label key={d}>
                          <input
                            {...attrs("preferred_destinations")}
                            type="checkbox"
                            checked={input.preferred_destinations.includes(d)}
                            onChange={() =>
                              setInput({
                                ...input,
                                preferred_destinations: toggle(
                                  input.preferred_destinations,
                                  d,
                                ),
                              })
                            }
                          />
                          <span>{d}</span>
                        </label>
                      ),
                    )}
                  </div>
                  <FieldError
                    id="error-preferred_destinations"
                    message={errors.preferred_destinations}
                  />
                </fieldset>
                <fieldset className="choice-set">
                  <legend>What’s your kind of trip?</legend>
                  <div className="choice-pills">
                    {interests.map((i) => (
                      <label key={i}>
                        <input
                          {...attrs("interests")}
                          type="checkbox"
                          checked={input.interests.includes(i)}
                          onChange={() =>
                            setInput({
                              ...input,
                              interests: toggle(input.interests, i),
                            })
                          }
                        />
                        <span>{i}</span>
                      </label>
                    ))}
                  </div>
                  <FieldError id="error-interests" message={errors.interests} />
                </fieldset>
                <fieldset className="choice-set">
                  <legend>How committed are you?</legend>
                  {(["Confirmed", "Interested", "Unsure"] as const).map(
                    (c, i) => (
                      <label className="choice-card" key={c}>
                        <input
                          {...attrs("commitment")}
                          type="radio"
                          name="commitment"
                          checked={input.commitment === c}
                          onChange={() => setInput({ ...input, commitment: c })}
                        />
                        <span>
                          <strong>{c}</strong>
                          <small>
                            {
                              [
                                "Count me in if the plan works.",
                                "I like the idea. Let’s see the details.",
                                "Still figuring things out.",
                              ][i]
                            }
                          </small>
                        </span>
                      </label>
                    ),
                  )}
                  <FieldError
                    id="error-commitment"
                    message={errors.commitment}
                  />
                </fieldset>
              </fieldset>
              {error && <Notice error>{error}</Notice>}
              <div className="form-actions">
                <p className="quiet">
                  Only your group leader can see the group’s responses. This is
                  a preference, not a booking or payment.
                </p>
                <button className="button button-dark" disabled={busy}>
                  {busy
                    ? "Saving response…"
                    : editToken
                      ? "Save my changes ↗"
                      : "Send my preferences ↗"}
                </button>
              </div>
            </form>
          </>
        )}
      </BackendGate>
    </div>
  );
}
