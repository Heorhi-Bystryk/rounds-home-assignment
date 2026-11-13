import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  addCompetitor,
  errorText,
  listCompetitors,
  removeCompetitor,
  type CompetitorListItem,
} from "../api/client";

export function CompetitorListPage() {
  const [id, setId] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await listCompetitors();
    if (result.status >= 200 && result.status < 300 && Array.isArray(result.body)) {
      setCompetitors(result.body);
      setError(null);
    } else {
      setError(errorText(result.body));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const result = await addCompetitor(id);
    if (result.status === 201) {
      setId("");
      setError(null);
      await reload();
      return;
    }
    if (result.status === 400 || result.status === 409) {
      setError(errorText(result.body));
      return;
    }
    setError(errorText(result.body));
  }

  async function onRemove(competitorId: string) {
    const result = await removeCompetitor(competitorId);
    if (result.status === 204) {
      setError(null);
      await reload();
      return;
    }
    setError(errorText(result.body));
  }

  return (
    <main className="page">
      <form onSubmit={onAdd}>
        <label>
          Competitor id
          <input
            value={id}
            onChange={(event) => setId(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit">Add</button>
      </form>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="status">Loading…</p> : null}

      <ul className="competitor-list">
        {competitors.map((competitor) => (
          <li key={competitor.id}>
            <div className="competitor-row">
              <Link
                className="competitor-id"
                to={`/competitors/${encodeURIComponent(competitor.id)}`}
              >
                {competitor.id}
              </Link>
              {competitor.changedLast24h ? (
                <span className="badge">Changed in the last 24 hours</span>
              ) : null}
              <button type="button" onClick={() => void onRemove(competitor.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
