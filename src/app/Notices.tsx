import type { Notice } from "../core/notices";

export function Notices({ items, checked }: { items: Notice[]; checked: string }) {
  if (!items.length) return null;
  return (
    <details className="notices" open={window.matchMedia("(min-width: 800px)").matches}>
      <summary><h2>In the news ({items.length}) <span className="muted">checked {checked}, not verified</span></h2></summary>
      <ul>
        {items.map((n) => (
          <li key={n.url + n.text}>
            <b className={`kind kind-${n.kind}`}>{n.kind}</b> {n.text}{" "}
            <a href={n.url} target="_blank" rel="noopener noreferrer nofollow">{n.source}, {n.date}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}
