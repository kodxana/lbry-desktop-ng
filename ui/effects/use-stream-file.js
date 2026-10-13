import React from 'react';

export default function useFileStream(readFile) {
  const [state, setState] = React.useState({ error: false, loading: true, content: null });
  React.useEffect(() => {
    let active = true;
    if (readFile) {
      readFile()
        .then((bytes) => {
          if (active) setState({ content: new Blob([bytes]), loading: false, error: false });
        })
        .catch(() => {
          if (active) setState({ error: true, loading: false, content: null });
        });
    }
    return () => {
      active = false;
    };
  }, [readFile]);
  return state;
}
