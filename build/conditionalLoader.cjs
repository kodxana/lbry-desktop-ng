const directive = /^\s*(?:\/\/\s*@([a-z]+)(.*?)|(?:\{)?\/\*\s*@([a-z]+)(.*?)\*\/(?:\})?)\s*$/i;
const operations = new Set([
  'if',
  'ifdef',
  'ifndef',
  'else',
  'endif',
  'include',
  'echo',
  'exec',
  'exclude',
  'endexclude',
  'foreach',
  'endfor',
]);

function condition(expression, values) {
  const match = /^([\w.]+)(?:\s*=\s*(['"])(.*?)\2)?$/.exec(expression);
  if (!match) throw new Error('Unsupported build condition: ' + expression);
  const value = match[1].split('.').reduce((object, key) => object && object[key], values);
  return match[2] ? value === match[3] : !!value;
}

function preprocess(source, values) {
  const stack = [];
  let active = true;
  const result = source
    .split(/(\r?\n)/)
    .map((line, index) => {
      if (index % 2) return line;
      const match = directive.exec(line);
      if (
        !match &&
        /(?:\/\/|\/\*)\s*@(if|ifdef|ifndef|else|endif|include|echo|exec|exclude|endexclude|foreach|endfor)\b/i.test(
          line
        )
      ) {
        throw new Error('Unsupported inline build directive on line ' + (index / 2 + 1));
      }
      const operation = match && (match[1] || match[3]).toLowerCase();
      if (!operations.has(operation)) return active ? line : '';
      const expression = (match[2] || match[4] || '').trim();
      if (operation === 'if') {
        const enabled = condition(expression, values);
        stack.push({ parent: active, enabled, hasElse: false });
        active = active && enabled;
      } else if (operation === 'else' || operation === 'endif') {
        const current = stack[stack.length - 1];
        if (!current || expression) throw new Error('Unexpected @' + operation + ' on line ' + (index / 2 + 1));
        if (operation === 'else') {
          if (current.hasElse) throw new Error('Duplicate @else on line ' + (index / 2 + 1));
          current.hasElse = true;
          active = current.parent && !current.enabled;
        } else {
          active = stack.pop().parent;
        }
      } else {
        throw new Error('Unsupported build directive: @' + operation);
      }
      return '';
    })
    .join('');
  if (stack.length) throw new Error('Missing @endif');
  return result;
}

module.exports = function conditionalLoader(source) {
  this.cacheable();
  return preprocess(source, this.getOptions());
};
module.exports.preprocess = preprocess;
