import desktop from 'util/desktop';
import { convertToShareLink } from 'util/lbryURI';

async function showMenu(event, request, target = event.target) {
  try {
    const result = await desktop.contextMenu({
      ...request,
      x: Math.max(0, Math.round(event.clientX)),
      y: Math.max(0, Math.round(event.clientY)),
    });
    // A menu can outlive the component that opened it.
    return target.isConnected && result && result.ok ? result.action : null;
  } catch (_) {
    return null;
  }
}

export function openContextMenu(event) {
  event.preventDefault();
  const target = event.target;
  const isInput = target.matches('input[type=text], input[type=number], input:not([type]), textarea');
  const inputSelected =
    isInput && typeof target.selectionStart === 'number' && target.selectionStart !== target.selectionEnd;
  return showMenu(event, {
    kind: 'text',
    hasText: isInput && !target.disabled && !!target.value,
    hasSelection: isInput ? inputSelected : window.getSelection().toString().length > 0,
    editable: isInput && !target.readOnly && !target.disabled,
  });
}

async function openCodeMenu(view, event, editable) {
  // Focus the contenteditable before main-process copy/cut/paste commands run.
  view.focus();
  const action = await showMenu(
    event,
    {
      kind: editable ? 'editor' : 'snippet',
      hasText: view.state.doc.length > 0,
      hasSelection: !view.state.selection.main.empty,
    },
    view.dom
  );
  if (action === 'editor-select-all' && view.dom.isConnected) {
    view.focus();
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
  }
}

// The publish-page Markdown editor and read-only code viewer share selection behavior.
export function openEditorMenu(view, event) {
  return openCodeMenu(view, event, !view.state.readOnly);
}

export function openSnippetMenu(view, event) {
  return openCodeMenu(view, event, false);
}

export async function openClaimPreviewMenu(claim, event) {
  // @if TARGET='app'
  event.preventDefault();
  const action = await showMenu(event, { kind: 'claim', hasClaim: !!claim });
  if (claim && action === 'copy-link') {
    try {
      await navigator.clipboard.writeText(convertToShareLink(claim.canonical_url || claim.permanent_url));
    } catch (_) {
      return false;
    }
  } else if (claim && action === 'report') {
    await desktop.openExternal(`https://lbry.com/dmca/${claim.claim_id}`);
  }
  // @endif
}

// Block context menu
export function stopContextMenu(event) {
  if (navigator.userAgent.toLowerCase().indexOf(' electron/') > -1) {
    event.preventDefault();
    event.stopPropagation();
  }
}
