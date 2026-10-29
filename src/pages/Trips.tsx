import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTrips, errorMessage } from "../lib/api";
import { Notice, PageHeading } from "../components/UI";
import type { Trip } from "../lib/types";
export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    listTrips()
      .then((data) => {
        if (live) setTrips(data);
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
  }, [attempt]);
  return (
    <div className="workspace">
      <div className="heading-actions">
        <PageHeading
          kicker="YOUR GROUP LEADER DESK"
          title="Good trips start here."
        >
          All your people. All your possibilities.
        </PageHeading>
        <Link className="button button-dark" to="/trips/new">
          + Create a trip
        </Link>
      </div>
      {loading ? (
        <Notice>Loading your trips…</Notice>
      ) : error ? (
        <>
          <Notice error>{error}</Notice>
          <button className="button" onClick={() => setAttempt(attempt + 1)}>
            Try again
          </button>
        </>
      ) : trips.length ? (
        <div className="trip-grid">
          {trips.map((trip, i) => (
            <Link
              className="panel trip-card"
              key={trip.id}
              to={`/trips/${trip.id}`}
            >
              <p className="eyebrow">TRIP / {String(i + 1).padStart(2, "0")}</p>
              <h2>{trip.name}</h2>
              <p>{trip.description || "A shared adventure in the making."}</p>
              <div className="row-between">
                <span>Minimum {trip.minimum_participants} people</span>
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <span className="empty-icon" aria-hidden="true">
            ↗
          </span>
          <h2>
            A blank page.
            <br />A world of possibilities.
          </h2>
          <p>
            Create your first trip, share the invitation, and let your friends
            weigh in.
          </p>
          <Link className="button button-dark" to="/trips/new">
            Plan your first trip ↗
          </Link>
        </div>
      )}
    </div>
  );
}
