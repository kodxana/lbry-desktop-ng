// @flow
import React from 'react';

const useEffectOnce = (effect: () => void | (() => void)): void => {
  React.useEffect(effect, []);
};

function useUnmount(fn: () => void): void {
  const fnRef = React.useRef(fn);

  // update the ref each render so if it change the newest callback will be invoked
  fnRef.current = fn;

  useEffectOnce(() => () => fnRef.current());
}

export default function useThrottle(value: string, ms: number = 200): string {
  const [state, setState] = React.useState(value);
  const timeout = React.useRef<ReturnType<typeof setTimeout> | void>();
  const nextValue = React.useRef(value);
  const hasNextValue = React.useRef(false);

  React.useEffect(() => {
    if (!timeout.current) {
      setState(value);
      const timeoutCallback = () => {
        if (hasNextValue.current) {
          hasNextValue.current = false;
          setState(nextValue.current);
          timeout.current = setTimeout(timeoutCallback, ms);
        } else {
          timeout.current = undefined;
        }
      };
      timeout.current = setTimeout(timeoutCallback, ms);
    } else {
      nextValue.current = value;
      hasNextValue.current = true;
    }
  }, [ms, value]);

  useUnmount(() => {
    timeout.current && clearTimeout(timeout.current);
  });

  return state;
}
