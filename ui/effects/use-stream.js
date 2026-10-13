import React from 'react';

export default function useStream(url) {
  const [state, setState] = React.useState({ error: false, loading: true, content: null });
  React.useEffect(() => {
    const controller = new AbortController();
    if (url) {
      fetch(url, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('Download failed');
          return response.blob();
        })
        .then((content) => {
          if (!controller.signal.aborted) setState({ content, loading: false, error: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ content: null, loading: false, error: true });
        });
    }
    return () => controller.abort();
  }, [url]);
  return state;
}
