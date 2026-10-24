// @flow
export type SyncPreference = {
  value?: {
    blocked?: Array<string>,
    subscriptions?: Array<string>,
    tags?: Array<string>,
    ...
  },
  ...
};

export default function mergeSyncPreferences(alt: SyncPreference, base: SyncPreference): SyncPreference {
  if (!alt.value) return base;
  const baseData = base.value || {};
  const altData = alt.value;
  return {
    ...base,
    value: {
      ...baseData,
      blocked: Array.from(new Set([...(baseData.blocked || []), ...(altData.blocked || [])])),
      subscriptions: Array.from(new Set([...(baseData.subscriptions || []), ...(altData.subscriptions || [])])),
      tags: Array.from(new Set([...(baseData.tags || []), ...(altData.tags || [])])),
    },
  };
}
