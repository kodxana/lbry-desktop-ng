// @flow
import * as React from 'react';
import { useSelector } from 'react-redux';
import { Router, useLocation } from 'react-router';

const DesktopHistory = React.createContext(null);

// Keep Redux navigation, form blockers and the desktop history menu on one history.
export default function DesktopRouter({ history, children }: { history: any, children: React.Node }) {
  const { location, action } = useSelector((state) => state.router);
  return (
    <DesktopHistory.Provider value={history}>
      <Router location={location} navigationType={action} navigator={history}>
        {children}
      </Router>
    </DesktopHistory.Provider>
  );
}

export function useDesktopHistory(): any {
  useLocation(); // Subscribe callers that read history.location during render.
  return React.useContext(DesktopHistory);
}

export function withDesktopRouter(Component: any): any {
  function WithDesktopRouter(props) {
    const history = useDesktopHistory();
    const location = useLocation();
    return <Component {...props} history={history} location={location} />;
  }
  WithDesktopRouter.displayName = `withDesktopRouter(${Component.displayName || Component.name || 'Component'})`;
  return WithDesktopRouter;
}
