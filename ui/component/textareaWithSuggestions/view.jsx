// @flow
import { EMOTES_48px as EMOTES } from 'constants/emotes';
import { matchSorter } from 'match-sorter';
import { SEARCH_OPTIONS } from 'constants/search';
import * as KEYCODES from 'constants/keycodes';
import Autocomplete from '@mui/material/Autocomplete';
import BusyIndicator from 'component/common/busy-indicator';
import { get as getEmoji, search as searchEmojis } from 'node-emoji';
import LbcSymbol from 'component/common/lbc-symbol';
import React from 'react';
import TextareaSuggestionsItem from 'component/textareaSuggestionsItem';
import TextField from '@mui/material/TextField';
import useLighthouse from 'effects/use-lighthouse';
import useThrottle from 'effects/use-throttle';
import { findSuggestion, completeSuggestion } from 'util/comment-suggestions';
import type { Suggestion } from 'util/comment-suggestions';

type SuggestionOption = { label: string, group: string };
type InputChange = { target: { value: string } };

const SEARCH_SIZE = 10;
const LIGHTHOUSE_MIN_CHARACTERS = 3;
const INPUT_DEBOUNCE_MS = 1000;

const EMOJI_MIN_CHARACTERS = 2;
const EMOJI_NAMES = searchEmojis('').map(({ name }) => name);

type Props = {
  canonicalCommentors?: Array<string>,
  canonicalCreatorUri?: string,
  canonicalSearch?: Array<string>,
  canonicalSubscriptions?: Array<string>,
  canonicalTop?: string,
  className?: string,
  commentorUris?: Array<string>,
  disabled?: boolean,
  hasNewResolvedResults?: boolean,
  id: string,
  inputRef: { current: ?HTMLTextAreaElement },
  isLivestream?: boolean,
  maxLength?: number,
  placeholder?: string,
  searchQuery?: string,
  showMature: boolean,
  type?: string,
  uri?: string,
  value: string,
  doResolveUris: (Array<string>) => void,
  doSetMentionSearchResults: (string, Array<string>) => void,
  onBlur?: () => unknown,
  onChange: (InputChange) => unknown,
  onFocus?: () => unknown,
};

export default function TextareaWithSuggestions(props: Props): React.Node {
  const {
    canonicalCommentors,
    canonicalCreatorUri,
    canonicalSearch,
    canonicalSubscriptions: canonicalSubs,
    canonicalTop,
    className,
    commentorUris,
    disabled,
    hasNewResolvedResults,
    id,
    inputRef,
    isLivestream,
    maxLength,
    placeholder,
    searchQuery,
    showMature,
    type,
    value: messageValue,
    doResolveUris,
    doSetMentionSearchResults,
    onBlur,
    onChange,
    onFocus,
  } = props;

  const inputDefaultProps = { className, placeholder, maxLength, type, disabled };

  const [suggestionValue, setSuggestionValue] = React.useState<?Suggestion>(undefined);
  // A highlight must not recreate the option list and reset MUI's keyboard position.
  const highlightedSuggestion = React.useRef<?SuggestionOption>(undefined);
  const [shouldClose, setClose] = React.useState(false);
  const [debouncedTerm, setDebouncedTerm] = React.useState('');
  const cursorAfterSelection = React.useRef<number | null>(null);

  const suggestionTerm = suggestionValue && suggestionValue.term;
  const isEmote = suggestionValue && suggestionValue.isEmote;
  const isMention = suggestionValue && !suggestionValue.isEmote;
  const invalidTerm = suggestionTerm && isMention && suggestionTerm.charAt(1) === ':';

  const additionalOptions: SearchOptions = {
    isBackgroundSearch: false,
    [SEARCH_OPTIONS.CLAIM_TYPE]: SEARCH_OPTIONS.INCLUDE_CHANNELS,
  };
  const { results, loading } = useLighthouse(debouncedTerm, showMature, SEARCH_SIZE, additionalOptions, 0);
  const stringifiedResults = JSON.stringify(results);

  const hasMinLength = suggestionTerm && isMention && suggestionTerm.length >= LIGHTHOUSE_MIN_CHARACTERS;
  const isTyping = isMention && debouncedTerm !== suggestionTerm;
  const showPlaceholder =
    isMention && !invalidTerm && (isTyping || loading || (results && results.length > 0 && !hasNewResolvedResults));

  const shouldFilter = (uri: string, previous?: Array<string>): boolean =>
    uri !== canonicalCreatorUri && (!previous || !previous.includes(uri));
  const filteredCommentors = canonicalCommentors && canonicalCommentors.filter((uri) => shouldFilter(uri));
  const filteredSubs = canonicalSubs && canonicalSubs.filter((uri) => shouldFilter(uri, filteredCommentors));
  const filteredTop =
    canonicalTop &&
    shouldFilter(canonicalTop, filteredSubs) &&
    shouldFilter(canonicalTop, filteredCommentors) &&
    canonicalTop;
  const filteredSearch =
    canonicalSearch &&
    canonicalSearch.filter(
      (uri) => shouldFilter(uri, filteredSubs) && shouldFilter(uri, filteredCommentors) && uri !== filteredTop
    );

  let emoteNames: Array<string> = [];
  let emojiNames: Array<string> = [];
  const allOptions: Array<string> = [];
  if (isEmote) {
    emoteNames = EMOTES.map(({ name }) => name.toLowerCase());
    const hasMinEmojiLength = suggestionTerm && suggestionTerm.length > EMOJI_MIN_CHARACTERS;
    // Filter because our emotes are priority from default emojis, like :eggplant:
    emojiNames = hasMinEmojiLength ? EMOJI_NAMES.filter((name) => !emoteNames.includes(`:${name}:`)) : [];
    const emotesAndEmojis = [...emoteNames, ...emojiNames];

    allOptions.push(...emotesAndEmojis);
  } else {
    if (canonicalCreatorUri) allOptions.push(canonicalCreatorUri);
    if (filteredSubs) allOptions.push(...filteredSubs);
    if (filteredCommentors) allOptions.push(...filteredCommentors);
    if (filteredTop) allOptions.push(filteredTop);
    if (filteredSearch) allOptions.push(...filteredSearch);
  }

  const allOptionsGrouped: Array<SuggestionOption> =
    allOptions.length > 0
      ? allOptions.map((option) => {
          const groupName = isEmote
            ? (emoteNames.includes(option) && __('Emotes')) || (emojiNames.includes(option) && __('Emojis'))
            : (canonicalCreatorUri === option && __('Creator')) ||
              (filteredSubs && filteredSubs.includes(option) && __('Following')) ||
              (filteredCommentors && filteredCommentors.includes(option) && __('From Comments')) ||
              (filteredTop && filteredTop === option && 'Top') ||
              (filteredSearch && filteredSearch.includes(option) && __('From Search'));

          let emoteLabel;
          if (isEmote) {
            emoteLabel = `:${option.replaceAll(':', '')}:`;
          }

          return {
            label: emoteLabel || option.replace('lbry://', '').replace('#', ':'),
            group: groupName || '',
          };
        })
      : [];

  const allMatches =
    useSuggestionMatch(
      suggestionTerm || '',
      allOptionsGrouped.map(({ label }) => label)
    ) || [];

  /** --------- **/
  /** Functions **/
  /** --------- **/

  function handleInputChange(value: string) {
    highlightedSuggestion.current = undefined;
    onChange({ target: { value } });

    setSuggestionValue(findSuggestion(value, inputRef.current?.selectionStart));
  }

  const handleSelect = React.useCallback(
    (selectedValue: string) => {
      if (!suggestionValue) return;

      const completion = completeSuggestion(messageValue, suggestionValue, selectedValue);
      cursorAfterSelection.current = completion.cursor;
      onChange({ target: { value: completion.value } });
      setSuggestionValue(null);
    },
    [messageValue, onChange, suggestionValue]
  );

  /** ------- **/
  /** Effects **/
  /** ------- **/

  React.useLayoutEffect(() => {
    const cursor = cursorAfterSelection.current;
    const input = inputRef.current;
    if (cursor !== null && input) {
      // Set the caret after React commits the controlled textarea value.
      input.focus();
      input.setSelectionRange(cursor, cursor);
      cursorAfterSelection.current = null;
    }
  }, [inputRef, messageValue, suggestionValue]);

  React.useEffect(() => {
    if (!isMention) return;

    if (isTyping && suggestionTerm && !invalidTerm) {
      const timer = setTimeout(() => {
        setDebouncedTerm(!hasMinLength ? '' : suggestionTerm);
      }, INPUT_DEBOUNCE_MS);

      return () => clearTimeout(timer);
    }
  }, [hasMinLength, invalidTerm, isMention, isTyping, suggestionTerm]);

  React.useEffect(() => {
    if (!stringifiedResults) return;

    const arrayResults = JSON.parse(stringifiedResults);
    if (debouncedTerm && arrayResults && arrayResults.length > 0) {
      doResolveUris([debouncedTerm, ...arrayResults]);
      doSetMentionSearchResults(debouncedTerm, arrayResults);
    }
  }, [debouncedTerm, doResolveUris, doSetMentionSearchResults, stringifiedResults, suggestionTerm]);

  // Disable sending on Enter on Livestream chat
  React.useEffect(() => {
    if (!isLivestream) return;

    const input = inputRef.current;
    if (!input) return;
    if (suggestionTerm) {
      input.setAttribute('term', suggestionTerm);
    } else {
      input.removeAttribute('term');
    }
  }, [inputRef, isLivestream, suggestionTerm]);

  // Only resolve commentors on Livestreams when first trying to mention/looking for it
  React.useEffect(() => {
    if (isLivestream && commentorUris && suggestionTerm) doResolveUris(commentorUris);
  }, [commentorUris, doResolveUris, isLivestream, suggestionTerm]);

  function handleKeyDown(event: {
    keyCode: number,
    nativeEvent: { isComposing?: boolean, ... },
    preventDefault: () => void,
    defaultMuiPrevented?: boolean,
    ...
  }) {
    // MUI reports user highlight changes only; automatic highlighting uses the first match.
    const highlighted =
      highlightedSuggestion.current === undefined
        ? allOptionsGrouped.find(({ label }) => allMatches.includes(label))
        : highlightedSuggestion.current;
    if (
      !suggestionTerm ||
      shouldClose ||
      !highlighted ||
      !allMatches.includes(highlighted.label) ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }

    // MUI 9 gives free text priority over automatic highlighting on Enter.
    // Comment completion keeps Enter and Tab selecting the visible suggestion.
    if (event.keyCode === KEYCODES.ENTER || event.keyCode === KEYCODES.TAB) {
      event.preventDefault();
      event.defaultMuiPrevented = true;
      handleSelect(highlighted.label);
    }
  }

  /** ------ **/
  /** Render **/
  /** ------ **/

  const renderGroup = (groupName: string, children: React.Node): React.Node => (
    <div key={groupName} className="textareaSuggestions__group">
      <label className="textareaSuggestions__label">
        {groupName === 'Top' ? (
          <LbcSymbol prefix={__('Winning Search for %matching_term%', { matching_term: searchQuery || '' })} />
        ) : suggestionTerm && suggestionTerm.length > 1 ? (
          __('%group_name% matching %matching_term%', { group_name: groupName, matching_term: suggestionTerm })
        ) : (
          groupName
        )}
      </label>
      {children}
      <hr className="textareaSuggestions__topSeparator" />
    </div>
  );

  const renderInput = (params: any) => {
    return (
      <TextField
        {...params}
        inputRef={inputRef}
        multiline
        slotProps={{
          ...params.slotProps,
          htmlInput: { ...params.slotProps.htmlInput, ...inputDefaultProps },
        }}
      />
    );
  };

  const renderOption = (optionProps: any, label: string) => {
    const emoteFound = isEmote && EMOTES.find(({ name }) => name.toLowerCase() === label);
    const emoteValue = emoteFound ? { name: label, url: emoteFound.url } : undefined;
    const emojiFound = isEmote && getEmoji(label);
    const emojiValue = emojiFound ? { name: label, unicode: emojiFound } : undefined;

    return <TextareaSuggestionsItem key={label} uri={label} emote={emoteValue || emojiValue} {...optionProps} />;
  };

  return (
    <Autocomplete
      slotProps={{ popper: { placement: 'top' } }}
      autoHighlight
      disableClearable
      filterOptions={(options) => options.filter(({ label }) => allMatches.includes(label))}
      freeSolo
      fullWidth
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      groupBy={(option) => option.group}
      id={id}
      inputValue={messageValue}
      value={null}
      loading={allMatches.length === 0 || showPlaceholder}
      loadingText={showPlaceholder ? <BusyIndicator message={__('Searching...')} /> : __('Nothing found')}
      onBlur={() => onBlur && onBlur()}
      /* Different from onInputChange, onChange is only used for the selected value,
        so here it is acting simply as a selection handler (see it as onSelect) */
      onChange={(event, value, reason) => {
        if (reason === 'selectOption' && value && typeof value !== 'string') handleSelect(value.label);
      }}
      onClose={(event, reason) => reason !== 'selectOption' && setClose(true)}
      onFocus={() => onFocus && onFocus()}
      onHighlightChange={(event, option) => {
        highlightedSuggestion.current = option;
      }}
      onInputChange={(event, value, reason) => reason === 'input' && handleInputChange(value)}
      onKeyDown={handleKeyDown}
      onOpen={() => suggestionTerm && setClose(false)}
      /* 'open' is for the popper box component, set to check for a valid term
        or else it will be displayed all the time as empty (no options) */
      open={!!suggestionTerm && !shouldClose}
      options={allOptionsGrouped}
      renderGroup={({ group, children }) => renderGroup(group, children)}
      renderInput={(params) => renderInput(params)}
      renderOption={(optionProps, option) => renderOption(optionProps, option.label)}
    />
  );
}

function useSuggestionMatch(term: string, list: Array<string>): Array<string> | void {
  const throttledTerm = useThrottle(term);

  return React.useMemo(() => {
    return !throttledTerm || throttledTerm.trim() === ''
      ? undefined
      : matchSorter(list, term, { keys: [(item) => item] });
  }, [list, term, throttledTerm]);
}
