import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { errorText, listSnapshots, type Snapshot } from "../api/client";
import { summaryReason } from "../api/summary-reason";

export function CompetitorTimelinePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await listSnapshots(id);
      if (cancelled) {
        return;
      }
      if (result.status >= 200 && result.status < 300 && Array.isArray(result.body)) {
        setSnapshots(result.body);
        setError(null);
      } else {
        setSnapshots([]);
        setError(errorText(result.body));
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="page">
      <p className="back-link">
        <button type="button" onClick={() => navigate("/")}>
          Back to competitors
        </button>
      </p>
      <h1 className="page-title competitor-id">{id}</h1>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="status">Loading…</p> : null}
      {!loading && !error && snapshots.length === 0 ? (
        <p className="status">No snapshots yet.</p>
      ) : null}

      <ol className="timeline">
        {snapshots.map((snapshot) => {
          const reason =
            snapshot.summary === null
              ? summaryReason(snapshot.summaryStatus, snapshot.pollStatus)
              : null;

          return (
            <li key={snapshot.fetchedAt}>
              <p className="timeline-meta">
                <strong>{new Date(snapshot.fetchedAt).toLocaleString()}</strong>
                {snapshot.changed ? (
                  <>
                    {" "}
                    <span className="badge">changed</span>
                  </>
                ) : null}
              </p>
              <p>Title: {snapshot.title ?? "—"}</p>
              <p>Tagline: {snapshot.tagline ?? "—"}</p>
              <p>Price: {snapshot.price ?? "—"}</p>
              <p>Description: {snapshot.description ?? "—"}</p>
              {typeof snapshot.summary === "string" ? (
                <p className="timeline-summary">Summary: {snapshot.summary}</p>
              ) : (
                <p className="timeline-summary muted">
                  Summary: {reason ?? "—"}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
