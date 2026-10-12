import { clipboard, ipcRenderer, shell } from 'electron';
import { convertToShareLink } from 'util/lbryURI';

async function showMenu(event, request, target = event.target) {
  event.preventDefault();
  try {
    const result = await ipcRenderer.invoke('context-menu', {
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
  const target = event.target;
  const isInput = target.matches('input[type=text], input[type=number], input:not([type]), textarea');
  const inputSelected =
    isInput && typeof target.selectionStart === 'number' && target.selectionStart !== target.selectionEnd;
  return showMenu(event, {
    kind: 'text',
    hasText: !!target.value,
    hasSelection: isInput ? inputSelected : window.getSelection().toString().length > 0,
    editable: isInput && !target.readOnly && !target.disabled,
  });
}

async function openCodeMenu(codeMirror, event, editable) {
  // The native edit commands act on CodeMirror's focused input.
  codeMirror.focus();
  const action = await showMenu(
    event,
    {
      kind: editable ? 'editor' : 'snippet',
      hasText: codeMirror.doc.getValue().length > 0,
      hasSelection: codeMirror.doc.getSelection().length > 0,
    },
    codeMirror.getWrapperElement()
  );
  if (action === 'editor-select-all' && codeMirror.getWrapperElement().isConnected) {
    codeMirror.focus();
    codeMirror.execCommand('selectAll');
  }
}

// The publish-page Markdown editor and read-only code viewer share selection behavior.
export function openEditorMenu(codeMirror, event) {
  return openCodeMenu(codeMirror, event, !codeMirror.getOption('readOnly'));
}

export function openSnippetMenu(codeMirror, event) {
  return openCodeMenu(codeMirror, event, false);
}

export async function openClaimPreviewMenu(claim, event) {
  // @if TARGET='app'
  const action = await showMenu(event, { kind: 'claim', hasClaim: !!claim });
  if (claim && action === 'copy-link') {
    clipboard.writeText(convertToShareLink(claim.canonical_url || claim.permanent_url));
  } else if (claim && action === 'report') {
    await shell.openExternal(`https://lbry.com/dmca/${claim.claim_id}`);
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
