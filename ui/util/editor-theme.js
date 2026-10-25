// @flow
import type { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Use the application's existing palette in both themes.
export const editorHighlighting: Extension = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading, class: 'cm-header' },
    { tag: tags.strong, class: 'cm-strong' },
    { tag: tags.emphasis, class: 'cm-em' },
    { tag: tags.strikethrough, class: 'cm-strikethrough' },
    { tag: tags.link, class: 'cm-link' },
    { tag: tags.url, class: 'cm-url' },
    { tag: tags.quote, class: 'cm-quote' },
    { tag: tags.monospace, class: 'cm-code' },
    { tag: tags.keyword, class: 'cm-keyword' },
    { tag: tags.comment, class: 'cm-comment' },
    { tag: tags.string, class: 'cm-string' },
    { tag: tags.number, class: 'cm-number' },
    { tag: tags.bool, class: 'cm-atom' },
    { tag: tags.tagName, class: 'cm-tag' },
    { tag: tags.attributeName, class: 'cm-attribute' },
    { tag: tags.variableName, class: 'cm-variable' },
    { tag: tags.propertyName, class: 'cm-property' },
    { tag: tags.typeName, class: 'cm-type' },
    { tag: tags.operator, class: 'cm-operator' },
    { tag: tags.invalid, class: 'cm-error' },
  ])
);
