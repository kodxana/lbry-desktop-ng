/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist/flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'collection-ui-'));
const write = (file, source) => {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), source);
};
for (const file of [
  '.flowconfig',
  'ui/component/collectionEdit/view.jsx',
  'ui/component/claimCollectionAdd/view.jsx',
  'ui/component/claimCollectionAddButton/view.jsx',
  'ui/component/collectionSelectItem/view.jsx',
  'ui/component/collectionPreviewOverlay/view.jsx',
  'ui/component/common/form-components/form-field.jsx',
  'ui/constants/icons.js',
  'ui/constants/pages.js',
  'ui/constants/claim.js',
  'ui/constants/tags.js',
  'ui/constants/collections.js',
  'ui/constants/thumbnail_upload_statuses.js',
  'ui/constants/form-field.js',
  'ui/constants/modal_types.js',
  'ui/constants/supported_languages.js',
  'flow-typed/npm/classnames_v2.x.x.js',
])
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (!/declare module\s/.test(source)) write('flow-typed/' + file, source);
}
write('node_modules/easymde/dist/easymde.min.css', '');
write(
  'ui/component/common/form.js',
  `// @flow
import * as React from 'react';
export {FormField} from './form-components/form-field';
declare export var FormFieldAreaAdvanced: React.ComponentType<{type: string, name: string, label: string,
  placeholder?: string, value?: string, onChange: (string) => void, textAreaMaxLength?: number}>;
`
);
// Presentation and connected components are checked at their used prop boundaries.
write(
  'flow-typed/inputs.js',
  `
declare module 'component/button' {
  import type {ComponentType, Node} from 'react';
  declare export default ComponentType<{button?: string, label?: Node, title?: string, className?: string,
    icon?: string, iconSize?: number, disabled?: boolean, onClick?: ({preventDefault: () => void, stopPropagation: () => void, ...}) => unknown}>;
}
declare module 'component/common/card' {
  import type {ComponentType, Node} from 'react';
  declare export default ComponentType<{title?: Node, body?: Node, actions?: Node, className?: string}>;
}
declare module 'component/common/icon' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{icon: string, className?: string}>;
}
declare module 'component/common/error-text' {
  import type {ComponentType, Node} from 'react';
  declare export default ComponentType<{children: Node}>;
}
declare module 'component/common/lbc-symbol' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{postfix: string, size?: number}>;
}
declare module 'component/claimAbandonButton' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{uri: string, abandonActionCallback: () => void}>;
}
declare module 'component/channelSelector' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{disabled: boolean}>;
}
declare module 'component/claimList' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{uris: ?Array<?string>, collectionId: string, empty: string, showEdit: boolean, droppableProvided: unknown}>;
}
declare module 'component/selectThumbnail' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{thumbnail?: string, thumbnailError: boolean, thumbnailParamStatus: string,
    updateThumbnailParams: (ThumbnailParams) => void, usePublishFormMode: boolean}>;
}
declare module 'component/collectionSelectItem' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{collectionId: string, uri: string, category: string}>;
}
declare module 'component/fileThumbnail' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{uri: string}>;
}
declare module 'component/tagsSearch' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{suggestMature: boolean, disableAutoFocus: boolean, limitSelect: number,
    tagsPassedIn: Array<Tag>, label: string, onRemove: (Tag) => void, onSelect: (Array<Tag>) => void}>;
}
declare module 'component/common/tabs' {
  import type {ComponentType, Node} from 'react';
  declare export var Tabs: ComponentType<{children: Node}>;
  declare export var TabList: ComponentType<{children: Node, className: string}>;
  declare export var Tab: ComponentType<{children: Node, index: number}>;
  declare export var TabPanels: ComponentType<{children: Node}>;
  declare export var TabPanel: ComponentType<{children: Node}>;
}
declare module '@hello-pangea/dnd' {
  import type {ComponentType, Node} from 'react';
  declare export var DragDropContext: ComponentType<{children: Node, onDragEnd: (CollectionDropResult) => void}>;
  declare export var Droppable: ComponentType<{droppableId: string, children: (unknown) => Node}>;
}
declare module 'component/common/desktop-router' {
  declare export function useDesktopHistory(): {replace: (string) => void};
}
declare module 'util/lbryURI' {
  declare export function isNameValid(name: string): boolean;
  declare export var regexInvalidURI: string;
}
declare module 'util/publish' {
  declare export function handleBidChange(bid: number, amount: ?number, balance: number, setError: (string) => void,
    setParam: ({bid: number}) => void): void;
}
declare module 'analytics' { declare export default {apiLogPublish: (Claim) => void}; }
`
);
const fixture = `// @flow
import * as React from 'react';
import CollectionForm from 'component/collectionEdit/view';
import type {Props as CollectionFormProps} from 'component/collectionEdit/view';
import Add from 'component/claimCollectionAdd/view';
import AddButton from 'component/claimCollectionAddButton/view';
import Item from 'component/collectionSelectItem/view';
export const create: CollectionCreateOptions = {name: 'list', bid: '1.00000001', claims: ['id']};
export const update: CollectionUpdateOptions = {claim_id: 'id', bid: 1, tags: [{name: 'test'}], locations: [{country: 'PL'}]};
export function formToCreate(form: CollectionFormData): CollectionCreateOptions {return form;}
export const add: React.Node = <Add claim={undefined} uri="lbry://item" builtin={{}} published={undefined} unpublished={{}} addCollection={() => {}} closeModal={() => {}} />;
export const item: React.Node = <Item collection={undefined} hasClaim={false} category="builtin" edited={false} editCollection={() => {}} uri="lbry://item" collectionPending={false} />;
export const addButton: React.Node = <AddButton uri="lbry://item" claim={undefined} isSaved={false} type="playlist" doOpenModal={() => {}} />;
export function thumbnail(props: CollectionFormProps): React.Node {return <CollectionForm {...props} thumbnailUrl={undefined} locations={[{country: 'PL'}]} />;}
`;
write('valid.jsx', fixture);
const check = () => {
  const result = spawnSync(require('flow-bin'), ['full-check', '--max-workers', '2', '--json', '--strip-root'], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert([0, 2].includes(result.status), result.stdout + result.stderr);
  return JSON.parse(result.stdout);
};
assert.deepEqual(check().errors, [], 'Collection form/control source and valid callers must type-check');
const invalid = {
  amount: 'export const invalid: CollectionCreateOptions = {...create, bid: false};',
  items: 'export const invalid: CollectionCreateOptions = {...create, claims: [7]};',
  tags: 'export const invalid: CollectionUpdateOptions = {...update, tags: ["test"]};',
  location: 'export const invalid: CollectionUpdateOptions = {...update, locations: ["PL"]};',
  updateId: 'export const invalid: CollectionUpdateOptions = {bid: "1"};',
  drop: 'export const invalid: CollectionDropResult = {source: {index: "1"}, destination: null};',
  mode: 'export const invalid: React.Node = <AddButton uri="x" claim={undefined} isSaved={false} type={true} doOpenModal={() => {}} />;',
  itemCallback:
    'export const invalid: React.Node = <Item collection={undefined} hasClaim={false} category="builtin" edited={false} editCollection={(id: number): void => {}} uri="x" collectionPending={false} />;',
  thumbnail:
    'export function invalid(props: CollectionFormProps): React.Node {return <CollectionForm {...props} thumbnailUrl={123} />;}',
};
for (const [name, source] of Object.entries(invalid)) write('invalid-' + name + '.jsx', fixture + '\n' + source);
const failed = check();
for (const name of Object.keys(invalid))
  assert(
    failed.errors.some(
      (error) =>
        !error.error_codes.includes('signature-verification-failure') &&
        error.message.some((message) => message.loc?.source.endsWith('invalid-' + name + '.jsx'))
    ),
    'Incorrect ' + name + ' contract must be rejected'
  );
console.log('PASS collection form/control source and ' + Object.keys(invalid).length + ' invalid contracts');
