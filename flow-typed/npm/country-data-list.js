declare module 'country-data-list' {
  declare export var countries: {
    all: ReadonlyArray<{
      alpha2: string,
      name: string,
      status: string,
      ...
    }>,
  };
}
