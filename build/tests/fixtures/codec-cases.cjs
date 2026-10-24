module.exports = function codecCases() {
  const circular = { name: 'cycle' };
  circular.self = circular;
  const nested = { child: { label: 'child' } };
  nested.child.parent = nested;
  const shared = { label: 'shared' };
  return [
    ['empty', {}],
    ['null', null],
    ['undefined', undefined],
    ['boolean', false],
    ['number', 12.5],
    ['text', 'Zażółć gęślą jaźń 🙂 漢字\u0000\ud800'],
    [
      'state',
      {
        wallet: { receiveAddress: 'fixture-address' },
        content: { positions: { fixture: { 'tx:0': 81.25 } }, history: ['lbry://fixture#abc'] },
        settings: { theme: 'dark', auto_download: false },
        collections: { saved: {}, unpublished: { fixture: { items: ['one', 'two'] } } },
      },
    ],
    [
      'json-values',
      { missing: undefined, array: [undefined, NaN, Infinity, -Infinity], date: new Date('2020-01-02T03:04:05Z') },
    ],
    ['cycle', circular],
    ['nested-cycle', nested],
    ['shared-reference', { one: shared, two: shared }],
    ...[1, 17, 256, 4096].map((length) => [
      'text-' + length,
      Array.from({ length }, (_, i) => String.fromCharCode((i * 7919) % 65536)).join(''),
    ]),
  ];
};
