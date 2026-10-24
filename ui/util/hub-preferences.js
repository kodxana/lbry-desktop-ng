// A connection recovered before sync must not be replaced by an old wallet preference.
export function withLocalHubPreference(preferences, servers) {
  if (preferences === null) return null;
  return {
    ...preferences,
    value: {
      ...preferences.value,
      settings: { ...preferences.value.settings, lbryum_servers: servers },
    },
  };
}
