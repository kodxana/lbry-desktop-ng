// @flow
import * as React from 'react';
import { useSelector } from 'react-redux';
import { Router, __RouterContext, __HistoryContext } from 'react-router';

// shortcut: Router 5 keeps a second location in component state; use its contexts
// until the route migration can replace them with a modern router.
export default function DesktopRouter({ history, children }: { history: any, children: React.Node }) {
  const location = useSelector((state) => state.router.location);
  const value = React.useMemo(
    () => ({ history, location, match: Router.computeRootMatch(location.pathname) }),
    [history, location]
  );
  return (
    <__RouterContext.Provider value={value}>
      <__HistoryContext.Provider value={history}>{children}</__HistoryContext.Provider>
    </__RouterContext.Provider>
  );
}
