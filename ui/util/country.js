// @flow
import { countries as countryData } from 'country-data-list';

export const COUNTRIES: Array<string> = Array.from(
  new Set(
    countryData.all
      .filter((country) => country.status !== 'deleted')
      .map((country) => country.name)
      .sort((a, b) => {
        if (a > b) {
          return 1;
        }
        if (b > a) {
          return -1;
        }
        return 0;
      })
  )
);

export function countryOptions(selected: string): Array<string> {
  // Accounts store names, including names that have since changed or been removed.
  return selected && !COUNTRIES.includes(selected) ? [selected, ...COUNTRIES] : COUNTRIES;
}
