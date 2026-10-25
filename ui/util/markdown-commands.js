// @flow
import type { Extension, ChangeSpec } from '@codemirror/state';
import { EditorState, Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'link'
  | 'image'
  | 'quote'
  | 'unordered-list'
  | 'ordered-list'
  | 'check-list'
  | 'code'
  | 'clean'
  | 'heading-smaller'
  | 'heading-bigger'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6';

export function formatMarkdown(view: EditorView, action: MarkdownAction): boolean {
  if (view.state.readOnly) return false;
  const { doc, selection } = view.state;
  let { from, to } = selection.main;
  let text = doc.sliceString(from, to);
  let anchor;
  let head;
  if (action === 'bold' || action === 'italic') {
    const marker = action === 'bold' ? '**' : '*';
    const marked = (before: string, after: string): boolean => {
      const count = Math.min((/\*+$/.exec(before) || [''])[0].length, (/^\*+/.exec(after) || [''])[0].length);
      return action === 'bold' ? count >= 2 : count % 2 === 1;
    };
    if (text.length >= marker.length * 2 && marked((/^\*+/.exec(text) || [''])[0], (/\*+$/.exec(text) || [''])[0])) {
      text = text.slice(marker.length, -marker.length);
      anchor = from;
      head = from + text.length;
    } else if (marked(doc.sliceString(doc.lineAt(from).from, from), doc.sliceString(to, doc.lineAt(to).to))) {
      from -= marker.length;
      to += marker.length;
      anchor = from;
      head = from + text.length;
    } else {
      text = marker + text + marker;
      anchor = from + marker.length;
      head = from + text.length - marker.length;
    }
  } else if (action === 'link' || action === 'image') {
    text = (action === 'image' ? '![' : '[') + text + '](https://)';
    anchor = from + text.length - 9;
    head = from + text.length - 1;
  } else {
    const first = doc.lineAt(from);
    const last = doc.lineAt(to > from && doc.lineAt(to).from === to ? to - 1 : to);
    from = first.from;
    to = last.to;
    const lines = doc.sliceString(from, to).split('\n');
    if (action === 'code') {
      text =
        lines.length >= 2 && lines[0] === '```' && lines[lines.length - 1] === '```'
          ? lines.slice(1, -1).join('\n')
          : '```\n' + lines.join('\n') + '\n```';
    } else if (action.startsWith('heading-')) {
      text = lines
        .map((line) => {
          const heading = /^(#{1,6})\s/.exec(line);
          const level = heading ? heading[1].length : 0;
          const next =
            action === 'heading-smaller'
              ? (level + 1) % 7
              : action === 'heading-bigger'
                ? (level + 6) % 7
                : Number(action.slice(-1)) === level
                  ? 0
                  : Number(action.slice(-1));
          return (next ? '#'.repeat(next) + ' ' : '') + line.replace(/^#{1,6}\s+/, '');
        })
        .join('\n');
    } else if (action === 'clean') {
      text = lines.map((line) => line.replace(/^(?:#{1,6}\s+|>\s?|[-+*]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/, '')).join('\n');
    } else {
      const pattern =
        action === 'quote'
          ? /^>\s?/
          : action === 'check-list'
            ? /^[-+*]\s+\[[ xX]\]\s+/
            : action === 'unordered-list'
              ? /^[-+*]\s+/
              : /^\d+\.\s+/;
      const remove = lines.every((line) => pattern.test(line));
      text = lines
        .map((line, i) =>
          remove
            ? line.replace(pattern, '')
            : (action === 'quote'
                ? '> '
                : action === 'unordered-list'
                  ? '* '
                  : action === 'check-list'
                    ? '* [ ] '
                    : `${i + 1}. `) + line
        )
        .join('\n');
    }
    anchor = from;
    head = from + text.length;
  }
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor, head },
    userEvent: 'input.format',
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

// User input is limited; restoring drafts and undo must never discard saved text.
export function editingLimits(getLimit: () => ?number): Extension {
  return EditorState.transactionFilter.of((transaction) => {
    if (!transaction.docChanged) return transaction;
    if (transaction.startState.readOnly) return [];
    if (transaction.isUserEvent('undo') || transaction.isUserEvent('redo')) return transaction;
    const limit = getLimit();
    if (!limit || transaction.newDoc.length <= Math.max(limit, transaction.startState.doc.length)) return transaction;
    if (transaction.isUserEvent('input.format')) return [];
    let removed = 0;
    transaction.changes.iterChanges((from, to) => {
      removed += to - from;
    });
    let available = Math.max(0, limit - transaction.startState.doc.length + removed);
    const edits: Array<ChangeSpec> = [];
    let cursor = transaction.startState.selection.main.head;
    let offset = 0;
    transaction.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => {
      let text = inserted.toString().slice(0, available);
      // Do not split an emoji's UTF-16 surrogate pair at the character limit.
      if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
      available -= text.length;
      edits.push({ from, to, insert: text });
      cursor = from + offset + text.length;
      offset += text.length - (to - from);
    });
    return { changes: edits, selection: { anchor: cursor }, userEvent: transaction.annotation(Transaction.userEvent) };
  });
}
