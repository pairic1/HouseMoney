import { useEffect, useState } from 'react';

export const ROUTES = {
  estimator: '/estimator',
  compare: '/compare',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

const KNOWN: Route[] = [ROUTES.estimator, ROUTES.compare];

function currentRoute(): Route {
  const raw = window.location.hash.replace(/^#/, '');
  return (KNOWN as string[]).includes(raw) ? (raw as Route) : ROUTES.estimator;
}

/**
 * Hash routing rather than paths: GitHub Pages serves static files with no
 * rewrite rule, so `/compare` would 404 on a refresh unless we shipped the
 * 404.html fallback hack. The hash keeps back/forward and bookmarking working
 * with none of that.
 */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? ROUTES.estimator : currentRoute(),
  );

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (r: Route) => {
    if (window.location.hash !== `#${r}`) window.location.hash = r;
    else setRoute(r);
  };

  return [route, navigate];
}
