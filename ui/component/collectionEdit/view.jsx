// @flow

import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import React from 'react';
import classnames from 'classnames';
import Button from 'component/button';
import TagsSearch from 'component/tagsSearch';
import ErrorText from 'component/common/error-text';
import ClaimAbandonButton from 'component/claimAbandonButton';
import ChannelSelector from 'component/channelSelector';
import ClaimList from 'component/claimList';
import Card from 'component/common/card';
import LbcSymbol from 'component/common/lbc-symbol';
import SelectThumbnail from 'component/selectThumbnail';
import { useDesktopHistory } from 'component/common/desktop-router';
import { isNameValid, regexInvalidURI } from 'util/lbryURI';
import * as THUMBNAIL_STATUSES from 'constants/thumbnail_upload_statuses';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'component/common/tabs';
import { FormField, FormFieldAreaAdvanced } from 'component/common/form';
import { handleBidChange } from 'util/publish';
import { FF_MAX_CHARS_IN_DESCRIPTION } from 'constants/form-field';
import { INVALID_NAME_ERROR } from 'constants/claim';
import SUPPORTED_LANGUAGES from 'constants/supported_languages';
import * as PAGES from 'constants/pages';
import analytics from 'analytics';

const LANG_NONE = 'none';
const MAX_TAG_SELECT = 5;

export type Props = {
  uri: ?string,
  claim: ?CollectionClaim,
  balance: number,
  disabled: boolean,
  activeChannelClaim: ?ChannelClaim,
  incognito: boolean,
  // params
  title: ?string,
  amount: ?number,
  thumbnailUrl: ?string,
  description: ?string,
  tags: ?Array<string>,
  locations: ?Array<ClaimLocation>,
  languages: ?Array<string>,
  collectionId: string,
  collection: ?Collection,
  collectionClaimIds: ?Array<string>,
  collectionUrls: ?Array<?string>,
  updatingCollection: boolean,
  updateError: ?string,
  createError: ?string,
  creatingCollection: boolean,
  publishCollectionUpdate: (CollectionUpdateOptions) => Promise<Claim | void>,
  publishCollection: (CollectionCreateOptions, string) => Promise<Claim | void>,
  clearCollectionErrors: () => void,
  onDone: (string) => void,
  setActiveChannel: (string) => void,
  setIncognito: (boolean) => void,
  doCollectionEdit: (CollectionEditParams) => void,
  resetThumbnailStatus: () => void,
};

function CollectionForm(props: Props): React.Node {
  const {
    uri, // collection uri
    claim,
    balance,
    // publish params
    amount,
    title,
    description,
    thumbnailUrl,
    tags,
    locations,
    languages = [],
    // rest
    updateError,
    updatingCollection,
    creatingCollection,
    createError,
    disabled,
    activeChannelClaim,
    incognito,
    collectionId,
    collection,
    collectionUrls,
    collectionClaimIds,
    publishCollectionUpdate,
    publishCollection,
    clearCollectionErrors,
    setActiveChannel,
    setIncognito,
    onDone,
    doCollectionEdit,
    resetThumbnailStatus,
  } = props;
  const activeChannelName = activeChannelClaim && activeChannelClaim.name;
  let prefix = 'lbry://';
  if (activeChannelName && !incognito) {
    prefix += `${activeChannelName}/`;
  }
  const activeChannelId = activeChannelClaim && activeChannelClaim.claim_id;
  const collectionName = (claim && claim.name) || (collection && collection.name);
  const collectionChannel = claim && claim.signing_channel ? claim.signing_channel.claim_id : undefined;
  const hasClaim = !!claim;
  const [initialized, setInitialized] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | void>(undefined);
  const [bidError, setBidError] = React.useState('');
  const [thumbStatus, setThumbStatus] = React.useState('');
  const [thumbError, setThumbError] = React.useState(false);
  const [params, setParams] = React.useState<CollectionFormData>({
    name: '',
    bid: '0.001',
    tags: [],
    languages: [],
    locations: [],
    claims: [],
  });
  const name = params.name;
  const isNewCollection = !uri;
  const { replace } = useDesktopHistory();
  const languageParam = params.languages;
  const primaryLanguage = languageParam[0] || LANG_NONE;
  const secondaryLanguage = languageParam[1] || LANG_NONE;
  const hasClaims = params.claims && params.claims.length;
  const collectionClaimIdsString = JSON.stringify(collectionClaimIds || []);
  const itemError = !hasClaims ? __('Cannot publish empty list') : '';
  const thumbnailError =
    (thumbError && thumbStatus !== THUMBNAIL_STATUSES.COMPLETE && __('Invalid thumbnail')) ||
    (thumbStatus === THUMBNAIL_STATUSES.IN_PROGRESS && __('Please wait for thumbnail to finish uploading'));
  const submitError = nameError || bidError || itemError || updateError || createError || thumbnailError;

  function parseName(newName: string): string {
    let INVALID_URI_CHARS = new RegExp(regexInvalidURI, 'gu');
    return newName.replace(INVALID_URI_CHARS, '-');
  }

  function setParam(paramObj: Readonly<Partial<CollectionFormData>>): void {
    setParams((previous) => ({ ...previous, ...paramObj }));
  }

  // TODO remove this or better decide whether app should delete languages[2+]
  // This was added because a previous update setting was duplicating language codes
  function dedupeLanguages(languages: Array<string>): Array<string> {
    if (languages.length <= 1) {
      return languages;
    } else if (languages.length === 2) {
      if (languages[0] !== languages[1]) {
        return languages;
      } else {
        return [languages[0]];
      }
    } else if (languages.length > 2) {
      const newLangs: Array<string> = [];
      languages.forEach((l) => {
        if (!newLangs.includes(l)) {
          newLangs.push(l);
        }
      });
      return newLangs;
    }
    return [];
  }

  function handleUpdateThumbnail(update: ThumbnailParams): void {
    if (update.thumbnail_url !== undefined) {
      setParam({ thumbnail_url: update.thumbnail_url });
    } else if (update.thumbnail_status) {
      setThumbStatus(update.thumbnail_status);
    } else {
      setThumbError(Boolean(update.thumbnail_error));
    }
  }

  function getCollectionParams(): CollectionFormData {
    const collectionParams: CollectionFormData = {
      thumbnail_url: thumbnailUrl ?? undefined,
      name: parseName(collectionName || ''),
      description: description ?? undefined,
      title: (claim ? title : collectionName) ?? undefined,
      bid: String(amount || 0.001),
      languages: languages ? dedupeLanguages(languages) : [],
      locations: locations || [],
      tags: tags
        ? tags.map((tag) => {
            return { name: tag };
          })
        : [],
      claim_id: claim ? claim.claim_id : undefined,
      channel_id: claim ? collectionChannel : activeChannelId || undefined,
      claims: collectionClaimIds || [],
    };

    return collectionParams;
  }

  function handleOnDragEnd(result: CollectionDropResult): void {
    const { source, destination } = result;

    if (!destination) return;

    const { index: from } = source;
    const { index: to } = destination;

    doCollectionEdit({ order: { from, to } });
  }

  function handleLanguageChange(index: number, code: string): void {
    let langs = [...languageParam];
    if (index === 0) {
      if (code === LANG_NONE) {
        // clear all
        langs = [];
      } else {
        langs[0] = code;
        if (langs[0] === langs[1]) {
          langs.length = 1;
        }
      }
    } else {
      if (code === LANG_NONE || code === langs[0]) {
        langs.splice(1, 1);
      } else {
        langs[index] = code;
      }
    }
    setParam({ languages: langs });
  }

  function handleSubmit(): void {
    if (uri) {
      if (!params.claim_id) return;
      publishCollectionUpdate({ ...params, claim_id: params.claim_id }).then((pendingClaim) => {
        if (pendingClaim) {
          const claimId = pendingClaim.claim_id;
          analytics.apiLogPublish(pendingClaim);
          onDone(claimId);
        }
      });
    } else {
      publishCollection(params, collectionId).then((pendingClaim) => {
        if (pendingClaim) {
          const claimId = pendingClaim.claim_id;
          analytics.apiLogPublish(pendingClaim);
          onDone(claimId);
        }
      });
    }
  }

  React.useEffect(() => {
    const collectionClaimIds: Array<string> = JSON.parse(collectionClaimIdsString) || [];
    setParams((previous) => ({ ...previous, claims: collectionClaimIds }));
    clearCollectionErrors();
  }, [collectionClaimIdsString, setParams]);

  React.useEffect(() => {
    let nameError;
    if (!name && name !== undefined) {
      nameError = __('A name is required for your url');
    } else if (!isNameValid(name)) {
      nameError = INVALID_NAME_ERROR;
    }

    setNameError(nameError);
  }, [name]);

  // on mount, if we get a collectionChannel, set it.
  React.useEffect(() => {
    if (!initialized) {
      if (hasClaim) {
        if (collectionChannel) {
          setActiveChannel(collectionChannel);
          setIncognito(false);
        } else {
          setIncognito(true);
        }
      } else {
        if (incognito) {
          setIncognito(true);
        }
      }
      setInitialized(true);
    }
  }, [setInitialized, setActiveChannel, collectionChannel, setIncognito, hasClaim, incognito, initialized]);

  // every time activechannel or incognito changes, set it.
  React.useEffect(() => {
    if (initialized) {
      if (activeChannelId && !incognito) {
        setParam({ channel_id: activeChannelId });
      }
      if (incognito) {
        setParam({ channel_id: undefined });
      }
    }
  }, [activeChannelId, incognito, initialized]);

  // setup initial params after we're sure if it's published or not
  React.useEffect(() => {
    if (!uri || hasClaim) {
      setParam(getCollectionParams());
    }
  }, [uri, hasClaim]);

  React.useEffect(() => {
    resetThumbnailStatus();
  }, [resetThumbnailStatus]);

  return (
    <>
      <div className={classnames('main--contained', { 'card--disabled': disabled })}>
        <Tabs>
          <TabList className="tabs__list--collection-edit-page">
            <Tab index={0}>{__('General')}</Tab>
            <Tab index={1}>{__('Items')}</Tab>
            <Tab index={2}>{__('Credits')}</Tab>
            <Tab index={3}>{__('Tags')}</Tab>
            <Tab index={4}>{__('Other')}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <div className={'card-stack'}>
                <ChannelSelector disabled={disabled} />
                <Card
                  body={
                    <>
                      <fieldset-group class="fieldset-group--smushed fieldset-group--disabled-prefix">
                        <fieldset-section>
                          <label htmlFor="channel_name">{__('Name')}</label>
                          <div className="form-field__prefix">{prefix}</div>
                        </fieldset-section>

                        <FormField
                          autoFocus={isNewCollection}
                          type="text"
                          name="channel_name"
                          placeholder={__('MyAwesomeList')}
                          value={params.name}
                          error={nameError}
                          disabled={!isNewCollection}
                          onChange={(e) => setParam({ name: e.target.value || '' })}
                        />
                      </fieldset-group>
                      {!isNewCollection && (
                        <span className="form-field__help">{__('This field cannot be changed.')}</span>
                      )}

                      <FormField
                        type="text"
                        name="channel_title2"
                        label={__('Title')}
                        placeholder={__('My Awesome List')}
                        value={params.title}
                        onChange={(e) => setParam({ title: e.target.value })}
                      />
                      <fieldset-section>
                        <SelectThumbnail
                          thumbnail={params.thumbnail_url}
                          thumbnailError={thumbError}
                          thumbnailParamStatus={thumbStatus}
                          updateThumbnailParams={handleUpdateThumbnail}
                          usePublishFormMode
                        />
                      </fieldset-section>
                      <FormFieldAreaAdvanced
                        type="markdown"
                        name="content_description2"
                        label={__('Description')}
                        placeholder={__('Description of your content')}
                        value={params.description}
                        onChange={(text) => setParam({ description: text })}
                        textAreaMaxLength={FF_MAX_CHARS_IN_DESCRIPTION}
                      />
                    </>
                  }
                />
              </div>
            </TabPanel>
            <TabPanel>
              <DragDropContext onDragEnd={handleOnDragEnd}>
                <Droppable droppableId="list__ordering">
                  {(DroppableProvided) => (
                    <ClaimList
                      uris={collectionUrls}
                      collectionId={collectionId}
                      empty={__('This list has no items.')}
                      showEdit
                      droppableProvided={DroppableProvided}
                    />
                  )}
                </Droppable>
              </DragDropContext>
            </TabPanel>
            <TabPanel>
              <Card
                body={
                  <FormField
                    className="form-field--price-amount"
                    type="number"
                    name="content_bid2"
                    step="any"
                    label={<LbcSymbol postfix={__('Deposit')} size={14} />}
                    value={params.bid}
                    error={bidError}
                    min={0}
                    disabled={false}
                    onChange={(event) =>
                      handleBidChange(parseFloat(event.target.value), amount, balance, setBidError, setParam)
                    }
                    placeholder={0.1}
                    helper={__('Increasing your deposit can help your channel be discovered more easily.')}
                  />
                }
              />
            </TabPanel>
            <TabPanel>
              <Card
                body={
                  <TagsSearch
                    suggestMature
                    disableAutoFocus
                    limitSelect={MAX_TAG_SELECT}
                    tagsPassedIn={params.tags || []}
                    label={__('Selected Tags')}
                    onRemove={(clickedTag: Tag) => {
                      setParams((previous) => ({
                        ...previous,
                        tags: previous.tags.filter((tag) => tag.name !== clickedTag.name),
                      }));
                    }}
                    onSelect={(newTags: Array<Tag>) => {
                      newTags.forEach((newTag) => {
                        setParams((previous) => ({
                          ...previous,
                          tags: previous.tags.some((tag) => tag.name === newTag.name)
                            ? previous.tags.filter((tag) => tag.name !== newTag.name)
                            : [...previous.tags, newTag],
                        }));
                      });
                    }}
                  />
                }
              />
            </TabPanel>
            <TabPanel>
              <Card
                body={
                  <>
                    <FormField
                      name="language_select"
                      type="select"
                      label={__('Primary Language')}
                      onChange={(event) => handleLanguageChange(0, event.target.value)}
                      value={primaryLanguage}
                      helper={__('Your main content language')}
                    >
                      <option key={'pri-langNone'} value={LANG_NONE}>
                        {__('None selected')}
                      </option>
                      {Object.keys(SUPPORTED_LANGUAGES).map((language) => (
                        <option key={language} value={language}>
                          {SUPPORTED_LANGUAGES[language]}
                        </option>
                      ))}
                    </FormField>
                    <FormField
                      name="language_select2"
                      type="select"
                      label={__('Secondary Language')}
                      onChange={(event) => handleLanguageChange(1, event.target.value)}
                      value={secondaryLanguage}
                      disabled={!languageParam[0]}
                      helper={__('Your other content language')}
                    >
                      <option key={'sec-langNone'} value={LANG_NONE}>
                        {__('None selected')}
                      </option>
                      {Object.keys(SUPPORTED_LANGUAGES)
                        .filter((lang) => lang !== languageParam[0])
                        .map((language) => (
                          <option key={language} value={language}>
                            {SUPPORTED_LANGUAGES[language]}
                          </option>
                        ))}
                    </FormField>
                  </>
                }
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
        <Card
          className="card--after-tabs"
          actions={
            <>
              <div className="section__actions">
                <Button
                  button="primary"
                  disabled={Boolean(
                    creatingCollection || updatingCollection || nameError || bidError || thumbnailError || !hasClaims
                  )}
                  label={creatingCollection || updatingCollection ? __('Submitting') : __('Submit')}
                  onClick={handleSubmit}
                />
                <Button button="link" label={__('Cancel')} onClick={() => onDone(collectionId)} />
              </div>
              {submitError ? (
                <ErrorText>{submitError}</ErrorText>
              ) : (
                <p className="help">
                  {__('After submitting, it will take a few minutes for your changes to be live for everyone.')}
                </p>
              )}
              {uri && (
                <div className="section__actions">
                  <ClaimAbandonButton uri={uri} abandonActionCallback={() => replace(`/$/${PAGES.LIBRARY}`)} />
                </div>
              )}
            </>
          }
        />
      </div>
    </>
  );
}

export default CollectionForm;
