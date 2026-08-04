import { ChipMark } from './components/ChipMark';
import { AppNav } from './components/AppNav';
import { ROUTES, useHashRoute } from './state/useHashRoute';
import { Estimator } from './pages/Estimator';
import { Compare } from './pages/Compare';

export default function App() {
  const [route] = useHashRoute();

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="wordmark">
          <ChipMark />
          <span className="wordmark-text">
            House<span>Money</span>
          </span>
        </h1>
        <AppNav route={route} />
      </header>

      {route === ROUTES.compare ? <Compare /> : <Estimator />}
    </div>
  );
}
