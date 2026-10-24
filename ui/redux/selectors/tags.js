// @flow
import { createSelector } from 'reselect';

type State = { tags?: TagState, ... };
const EMPTY_TAGS: TagState = { knownTags: {}, followedTags: [] };

const selectState = (state: State): TagState => state.tags || EMPTY_TAGS;

export const selectKnownTagsByName: (State) => KnownTags = createSelector(
  selectState,
  (state: TagState): KnownTags => state.knownTags
);

export const selectFollowedTagsList = (state: State): Array<string> => selectState(state).followedTags;

export const selectFollowedTags: (State) => Array<Tag> = createSelector(
  selectFollowedTagsList,
  (followedTags: Array<string>): Array<Tag> =>
    followedTags.map((tag): Tag => ({ name: tag.toLowerCase() })).sort((a, b) => a.name.localeCompare(b.name))
);

export const selectUnfollowedTags: (State) => Array<Tag> = createSelector(
  selectKnownTagsByName,
  selectFollowedTagsList,
  (tagsByName: KnownTags, followedTags: Array<string>): Array<Tag> => {
    const followedTagsSet = new Set(followedTags);
    let tagsToReturn: Array<Tag> = [];
    Object.keys(tagsByName).forEach((key) => {
      if (!followedTagsSet.has(key)) {
        const { name } = tagsByName[key];
        tagsToReturn.push({ name: name.toLowerCase() });
      }
    });

    return tagsToReturn;
  }
);

export const makeSelectIsFollowingTag = (tag: string): ((State) => boolean) =>
  createSelector(selectFollowedTags, (followedTags) => {
    return followedTags.some((followedTag) => followedTag.name === tag.toLowerCase());
  });
