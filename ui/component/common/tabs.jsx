// @flow
import React, { useState, useRef, useContext, useLayoutEffect, createContext } from 'react';
import * as Ariakit from '@ariakit/react';
import { v4 as uuid } from 'uuid';
import classnames from 'classnames';

const TabsContext = createContext('');

type TabsProps = {
  index?: number,
  onChange?: (number) => void,
  children: Array<React.Node>,
  className?: string,
};

function Tabs({ index, onChange, children, className, ...props }: TabsProps) {
  const [id] = useState(() => `tabs-${uuid()}`);
  const ref = useRef();
  const [indicator, setIndicator] = useState({});
  const store = Ariakit.useTabStore({
    rtl: document.documentElement.dir === 'rtl',
    defaultSelectedId: `${id}-0`,
    selectedId: index === undefined ? undefined : `${id}-${index}`,
    setSelectedId: (selected) => {
      if (onChange) onChange(Number(selected.slice(id.length + 1)));
    },
  });
  const selectedId = Ariakit.useStoreState(store, 'selectedId');

  useLayoutEffect(() => {
    const element = ref.current;
    const measure = () => {
      const selected = document.getElementById(selectedId);
      if (!selected || !element.contains(selected)) return;
      const rect = selected.getBoundingClientRect();
      const left = rect.left - element.getBoundingClientRect().left;
      setIndicator((previous) =>
        previous.left === left && previous.width === rect.width ? previous : { left, width: rect.width }
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('[role="tablist"], [role="tab"]').forEach((tab) => observer.observe(tab));
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selectedId]);

  return (
    <Ariakit.TabProvider store={store}>
      <TabsContext.Provider value={id}>
        <div {...props} className={classnames('tabs', className)} ref={ref}>
          {children[0]}
          <div className="tab__divider" style={indicator} />
          {children[1]}
        </div>
      </TabsContext.Provider>
    </Ariakit.TabProvider>
  );
}

function TabList({ className, ...props }: { className?: string, children: React.Node }) {
  return <Ariakit.TabList {...props} className={classnames('tabs__list', className)} />;
}

function Tab({ index, ...props }: { index: number, disabled?: boolean, children: React.Node }) {
  const id = useContext(TabsContext);
  return <Ariakit.Tab {...props} id={`${id}-${index}`} className="tab" type="button" accessibleWhenDisabled={false} />;
}

function TabPanels({ header, children, ...props }: { header?: React.Node, children: React.Node }) {
  const id = useContext(TabsContext);
  return (
    <>
      {header}
      <div {...props} className="tab__panels">
        {React.Children.map(children, (child, index) => React.cloneElement(child, { tabId: `${id}-${index}` }))}
      </div>
    </>
  );
}

function TabPanel(props: any) {
  return <Ariakit.TabPanel {...props} className="tab__panel" />;
}

export { Tabs, TabList, Tab, TabPanels, TabPanel };
