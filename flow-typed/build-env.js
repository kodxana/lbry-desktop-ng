// These expressions are replaced by webpack; the renderer does not receive Node's process object.
declare var process: {
  env: { [string]: string | void },
  platform: string,
};
