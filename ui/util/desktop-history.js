import { createMemoryHistory, parsePath } from 'history';
import { resolvePath } from 'react-router';

export default function createDesktopHistory(initialPath) {
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  // History 5 locations are immutable; menu titles belong to separate records.
  const entries = [{ ...history.location }];
  history.listen(({ action, location }) => {
    if (action === 'PUSH') entries.splice(history.index, entries.length, { ...location });
    else if (action === 'REPLACE') entries[history.index] = { ...location };
  });
  Object.defineProperties(history, {
    entries: { get: () => entries },
    length: { get: () => entries.length },
  });
  for (const method of ['push', 'replace']) {
    const navigate = history[method];
    history[method] = (to, state) => {
      const path = typeof to === 'string' ? parsePath(to) : to;
      // Keep relative desktop destinations relative to the current page's folder.
      const pathname = path.pathname;
      const destination =
        pathname && !pathname.startsWith('/')
          ? { ...path, pathname: resolvePath(pathname, history.location.pathname.replace(/[^/]*$/, '')).pathname }
          : path;
      navigate(destination, state);
    };
  }
  return history;
}
