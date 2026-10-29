import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createTrip, errorMessage } from "../lib/api";
import { validateTrip } from "../lib/validation";
import type { Errors, OptionInput, TripInput } from "../lib/types";
import { FieldError, Notice, PageHeading } from "../components/UI";
const blankOption = (): OptionInput => ({
  destination: "",
  start_date: "",
  end_date: "",
  estimated_cost: NaN,
});
export default function CreateTrip() {
  const navigate = useNavigate();
  const [input, setInput] = useState<TripInput>({
    name: "",
    description: "",
    minimum_participants: 2,
    options: [blankOption()],
    invitees: [],
  });
  const [names, setNames] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  function option(index: number, patch: Partial<OptionInput>) {
    setInput({
      ...input,
      options: input.options.map((o, i) =>
        i === index ? { ...o, ...patch } : o,
      ),
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const payload = {
      ...input,
      name: input.name.trim(),
      options: input.options.map((o) => ({
        ...o,
        destination: o.destination.trim(),
      })),
      invitees: names
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
    };
    const invalid = validateTrip(payload);
    setErrors(invalid);
    setError("");
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
      const id = await createTrip(payload);
      navigate(`/trips/${id}`);
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
  return (
    <div className="workspace form-width">
      <PageHeading
        kicker="01 / START A SHARED ADVENTURE"
        title="Give the group a plan."
      >
        A few possibilities. One invitation. Less back-and-forth.
      </PageHeading>
      <form ref={form} className="form-stack" onSubmit={submit} noValidate>
        <fieldset className="panel" disabled={busy}>
          <legend>
            <span className="step-number">01</span> The essentials
          </legend>
          <label>
            Trip name
            <input
              {...attrs("name")}
              required
              maxLength={120}
              placeholder="The long-weekend escape"
              value={input.name}
              onChange={(e) => setInput({ ...input, name: e.target.value })}
            />
            <FieldError id="error-name" message={errors.name} />
          </label>
          <label>
            A little context <span className="optional">optional</span>
            <textarea
              {...attrs("description")}
              maxLength={2000}
              rows={3}
              placeholder="What do you have in mind?"
              value={input.description}
              onChange={(e) =>
                setInput({ ...input, description: e.target.value })
              }
            />
            <FieldError id="error-description" message={errors.description} />
          </label>
          <label>
            Minimum group size, including you
            <input
              {...attrs("minimum_participants")}
              type="number"
              min={2}
              max={1000}
              step={1}
              required
              value={
                Number.isNaN(input.minimum_participants)
                  ? ""
                  : input.minimum_participants
              }
              onChange={(e) =>
                setInput({
                  ...input,
                  minimum_participants: e.target.valueAsNumber,
                })
              }
            />
            <FieldError
              id="error-minimum_participants"
              message={errors.minimum_participants}
            />
            <small>
              This is a planning target. It does not automatically count you as
              a respondent.
            </small>
          </label>
        </fieldset>
        <fieldset className="panel" disabled={busy}>
          <legend>
            <span className="step-number">02</span> Put some options on the
            table
          </legend>
          <p className="quiet">
            Each option pairs a destination, date range, and estimated cost per
            person in INR. Add another option to propose different dates or
            destinations.
          </p>
          {input.options.map((o, i) => (
            <div className="option-editor" key={i}>
              <div className="row-between">
                <h3>Option {String(i + 1).padStart(2, "0")}</h3>
                {input.options.length > 1 && (
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() =>
                      setInput({
                        ...input,
                        options: input.options.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
              <label>
                Destination
                <input
                  {...attrs(`destination-${i}`)}
                  required
                  maxLength={100}
                  value={o.destination}
                  placeholder="e.g. Goa"
                  onChange={(e) => option(i, { destination: e.target.value })}
                />
                <FieldError
                  id={`error-destination-${i}`}
                  message={errors[`destination-${i}`]}
                />
              </label>
              <div className="field-grid">
                <label>
                  Departure
                  <input
                    {...attrs(`dates-${i}`)}
                    required
                    type="date"
                    value={o.start_date}
                    onChange={(e) => option(i, { start_date: e.target.value })}
                  />
                </label>
                <label>
                  Return
                  <input
                    {...attrs(`dates-${i}`)}
                    required
                    type="date"
                    min={o.start_date}
                    value={o.end_date}
                    onChange={(e) => option(i, { end_date: e.target.value })}
                  />
                </label>
              </div>
              <FieldError
                id={`error-dates-${i}`}
                message={errors[`dates-${i}`]}
              />
              <label>
                Estimated per-person cost · INR
                <input
                  {...attrs(`cost-${i}`)}
                  required
                  type="number"
                  min={0}
                  max={100000000}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="12000"
                  value={Number.isNaN(o.estimated_cost) ? "" : o.estimated_cost}
                  onChange={(e) =>
                    option(i, { estimated_cost: e.target.valueAsNumber })
                  }
                />
                <FieldError
                  id={`error-cost-${i}`}
                  message={errors[`cost-${i}`]}
                />
              </label>
            </div>
          ))}
          <FieldError id="error-options" message={errors.options} />
          <button
            type="button"
            className="button"
            disabled={input.options.length >= 20}
            onClick={() =>
              setInput({ ...input, options: [...input.options, blankOption()] })
            }
          >
            + Add travel option
          </button>
        </fieldset>
        <fieldset className="panel" disabled={busy}>
          <legend>
            <span className="step-number">03</span> Who’s coming?{" "}
            <span className="optional">optional</span>
          </legend>
          <label>
            Invitation list · one name per line
            <textarea
              {...attrs("invitees")}
              rows={4}
              placeholder={"Aarav Sharma\nMaya Rao"}
              value={names}
              onChange={(e) => setNames(e.target.value)}
            />
            <FieldError id="error-invitees" message={errors.invitees} />
          </label>
          <p className="quiet">
            You’ll get a personal link for each person. Only responses through
            those links are matched to your invitation list. You can also share
            a general link.
          </p>
        </fieldset>
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <p className="quiet">You stay in control. No bookings or charges.</p>
          <button className="button button-dark" disabled={busy}>
            {busy ? "Creating trip…" : "Create trip & get invitation ↗"}
          </button>
        </div>
      </form>
    </div>
  );
}
