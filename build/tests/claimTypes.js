// @flow
import {
  selectClaimForUri,
  selectClaimWithId,
  selectClaimIdForUri,
  selectCreatingChannel,
  selectClaimIsMine,
  selectPendingIds,
  makeSelectClaimsInChannelForPage,
  makeSelectMetadataItemForUri,
  makeSelectReflectingClaimForUri,
  selectMyClaimsPageNumber,
  selectMyActiveClaims,
} from 'redux/selectors/claims';

declare var state: { claims: ClaimsState, ... };
declare var stream: StreamClaim;
declare var channel: ChannelClaim;
declare var repost: RepostClaim;
export { state, stream, channel, repost };
export const resolved: ?Claim = selectClaimForUri(state, 'lbry://stream');
export const loaded: Claim | void = selectClaimWithId(state, 'id');
export const claimId: ?string = selectClaimIdForUri(state, 'lbry://stream');
export const creating: boolean = selectCreatingChannel(state);
export const owned: boolean = selectClaimIsMine(state, stream);
export const pending: Array<string> = selectPendingIds(state);
export const active: Set<string> = selectMyActiveClaims(state);
export const page: number = selectMyClaimsPageNumber(state);
export const items: Array<Claim | void> | void = makeSelectClaimsInChannelForPage('lbry://@channel', 2)(state);
export const title: ?string = makeSelectMetadataItemForUri('lbry://stream', 'title')(state);
export const languages: ?Array<string> = makeSelectMetadataItemForUri('lbry://stream', 'languages')(state);
export const website: ?string = makeSelectMetadataItemForUri('lbry://@channel', 'website_url')(state);
export const reflecting: ReflectingUpdate | void = makeSelectReflectingClaimForUri('lbry://stream')(state);
export function duration(claim: Claim): number | void {
  if (claim.value_type === 'stream') return claim.value.video?.duration;
}
export function collectionSize(claim: Claim): number | void {
  if (claim.value_type === 'collection') return claim.value.claims.length;
}
export function resolvedMissing(value: ClaimsState): void {
  value.claimsByUri['lbry://missing'] = null;
  value.myClaims = undefined;
  value.myPurchases = null;
}
