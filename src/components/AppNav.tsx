import { ROUTES, type Route } from '../state/useHashRoute';

const TABS: { route: Route; label: string; blurb: string }[] = [
  { route: ROUTES.estimator, label: 'Payment Estimator', blurb: 'What would it cost per month' },
  { route: ROUTES.compare, label: 'Long Run', blurb: 'Move, wait, or stay put' },
];

export function AppNav({ route }: { route: Route }) {
  return (
    <nav className="app-nav" aria-label="Pages">
      {TABS.map((t) => (
        <a
          key={t.route}
          href={`#${t.route}`}
          className={`nav-tab${route === t.route ? ' active' : ''}`}
          aria-current={route === t.route ? 'page' : undefined}
        >
          <span className="nav-label">{t.label}</span>
          <span className="nav-blurb">{t.blurb}</span>
        </a>
      ))}
    </nav>
  );
}
