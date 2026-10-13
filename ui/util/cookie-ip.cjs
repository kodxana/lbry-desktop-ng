// tough-cookie uses net only to distinguish IP addresses from DNS suffixes.
// Delegate IPv6 syntax validation to Chromium rather than providing networking APIs.
exports.isIP = (value) => {
  if (typeof value !== 'string') return 0;
  if (/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value) && value.split('.').every((part) => Number(part) <= 255))
    { return 4 }
  if (value.includes(':') && /^[\da-f:.]+$/i.test(value)) {
    try {
      if (new URL('http://[' + value + ']/').hostname.startsWith('[')) return 6;
    } catch (_) {
      /* Invalid address. */
    }
  }
  return 0;
};
