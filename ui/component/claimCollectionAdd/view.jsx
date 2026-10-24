// @flow
import React from 'react';
import Button from 'component/button';
import Card from 'component/common/card';
import { FormField } from 'component/common/form';
import * as ICONS from 'constants/icons';
import CollectionSelectItem from 'component/collectionSelectItem';

type Props = {
  claim: ?Claim,
  builtin: CollectionGroup,
  published: ?CollectionGroup,
  unpublished: ?CollectionGroup,
  addCollection: (string, Array<string>, string) => void,
  closeModal: () => void,
  uri: string,
};

const ClaimCollectionAdd = (props: Props): React.Node => {
  const { builtin, published, unpublished, addCollection, claim, closeModal, uri } = props;
  const permanentUrl = claim && claim.permanent_url;
  const isChannel = claim && claim.value_type === 'channel';

  const [addNewCollection, setAddNewCollection] = React.useState(false);
  const [newCollectionName, setNewCollectionName] = React.useState('');

  // TODO: when other collection types added, filter list in context
  // const isPlayable =
  //   claim &&
  //   claim.value &&
  //   // $FlowFixMe
  //   claim.value.stream_type &&
  //   (claim.value.stream_type === 'audio' || claim.value.stream_type === 'video');

  function handleNameInput(e: { target: { value: string, ... }, ... }): void {
    const { value } = e.target;
    setNewCollectionName(value);
  }

  function handleAddCollection() {
    if (!permanentUrl || !newCollectionName.trim()) return;
    addCollection(newCollectionName, [permanentUrl], isChannel ? 'collection' : 'playlist');
    setNewCollectionName('');
    setAddNewCollection(false);
  }

  function altEnterListener(e: { key: string, preventDefault: () => void, ... }): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCollection();
    }
  }

  function handleClearNew() {
    setNewCollectionName('');
    setAddNewCollection(false);
  }

  return (
    <Card
      title={__('Add To...')}
      actions={
        <div className="card__body">
          {uri && permanentUrl && (
            <fieldset-section>
              <div className={'card__body-scrollable'}>
                {Object.values(builtin)
                  .filter((list) => (isChannel ? list.type === 'collection' : list.type === 'playlist'))
                  .map((l) => {
                    const { id } = l;
                    return <CollectionSelectItem collectionId={id} uri={permanentUrl} key={id} category={'builtin'} />;
                  })}
                {unpublished &&
                  Object.values(unpublished)
                    .filter((list) => (isChannel ? list.type === 'collection' : list.type === 'playlist'))
                    .map((l) => {
                      const { id } = l;
                      return (
                        <CollectionSelectItem collectionId={id} uri={permanentUrl} key={id} category={'unpublished'} />
                      );
                    })}
                {published &&
                  Object.values(published).map((l) => {
                    const { id } = l;
                    return (
                      <CollectionSelectItem collectionId={id} uri={permanentUrl} key={id} category={'published'} />
                    );
                  })}
              </div>
            </fieldset-section>
          )}
          <fieldset-section>
            {addNewCollection && (
              <FormField
                autoFocus
                type="text"
                name="new_collection"
                value={newCollectionName}
                label={__('New List Title')}
                onKeyDown={altEnterListener}
                inputButton={
                  <>
                    <Button
                      icon={ICONS.ADD}
                      className={'button-toggle'}
                      disabled={!permanentUrl || !newCollectionName.trim()}
                      onClick={() => handleAddCollection()}
                    />
                    <Button className={'button-toggle'} icon={ICONS.REMOVE} onClick={() => handleClearNew()} />
                  </>
                }
                onChange={handleNameInput}
              />
            )}
            {!addNewCollection && (
              <Button button={'link'} label={__('New List')} onClick={() => setAddNewCollection(true)} />
            )}
          </fieldset-section>
          <div className="card__actions">
            <Button button="secondary" label={__('Done')} disabled={addNewCollection} onClick={closeModal} />
          </div>
        </div>
      }
    />
  );
};
export default ClaimCollectionAdd;
