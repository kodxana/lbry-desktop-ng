// @flow
import React from 'react';
import * as Ariakit from '@ariakit/react';

type Selection = { onSelect: (string) => void, openOnFocus: boolean };
const SelectionContext = React.createContext<Selection>({ onSelect: () => {}, openOnFocus: false });

type ComboboxProps = {
  children: React$Node,
  onSelect: (string) => void,
  value: string,
  setValue: (string) => void,
  openOnFocus?: boolean,
  className?: string,
};

function Combobox({ children, onSelect, value, setValue, openOnFocus = false, ...props }: ComboboxProps) {
  return (
    <Ariakit.ComboboxProvider
      inputValue={value}
      setInputValue={setValue}
      resetValueOnHide={false}
      resetValueOnSelect={false}
    >
      <SelectionContext.Provider value={{ onSelect, openOnFocus }}>
        <div {...props}>{children}</div>
      </SelectionContext.Provider>
    </Ariakit.ComboboxProvider>
  );
}

const ComboboxInput = React.forwardRef<any, any>(function ComboboxInput({ selectOnClick, ...props }, ref) {
  const store = Ariakit.useComboboxContext();
  const { openOnFocus } = React.useContext(SelectionContext);
  return (
    <Ariakit.Combobox
      {...props}
      ref={ref}
      moveOnKeyPress={(event) => !['Home', 'End'].includes(event.key)}
      onFocus={() => {
        if (openOnFocus) store.show();
      }}
      onClick={(event) => {
        if (selectOnClick) event.currentTarget.select();
      }}
    />
  );
});

function ComboboxPopover(props: any) {
  return <Ariakit.ComboboxPopover {...props} portal={false} unmountOnHide sameWidth gutter={8} />;
}

function ComboboxList(props: any) {
  return <div {...props} className="search__list" />;
}

function ComboboxOption({ value, children, ...props }: { value: string, children?: React$Node, className?: string }) {
  const { onSelect } = React.useContext(SelectionContext);
  return (
    <Ariakit.ComboboxItem
      {...props}
      value={value}
      setValueOnClick={false}
      selectValueOnClick={false}
      onClick={() => onSelect(value)}
    >
      {children || value}
    </Ariakit.ComboboxItem>
  );
}

export { Combobox, ComboboxInput, ComboboxPopover, ComboboxList, ComboboxOption };
