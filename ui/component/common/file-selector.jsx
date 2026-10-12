// @flow
import * as React from 'react';
import * as remote from '@electron/remote';
import { ipcRenderer } from 'electron';
import Button from 'component/button';
import { FormField } from 'component/common/form';

type Props = {
  type: string,
  currentPath?: ?string,
  onFileChosen: (FileWithPath) => void,
  label?: string,
  placeholder?: string,
  accept?: string,
  error?: string,
  disabled?: boolean,
  autoFocus?: boolean,
  filters?: Array<{ name: string, extensions: string[] }>,
  readFile?: boolean,
};

type State = { selectionError?: string };

class FileSelector extends React.PureComponent<Props, State> {
  state = { selectionError: undefined };
  static defaultProps = {
    autoFocus: false,
    type: 'file',
    readFile: true,
  };

  fileInput: React.ElementRef<any>;

  constructor() {
    super();
    this.fileInput = React.createRef();
    this.handleFileInputSelection = this.handleFileInputSelection.bind(this);
    this.handleDirectoryInputSelection = this.handleDirectoryInputSelection.bind(this);
    this.fileInputButton = this.fileInputButton.bind(this);
  }

  handleFileInputSelection = () => {
    const { files } = this.fileInput.current;
    if (!files || !files.length) {
      return;
    }

    const file = files[0];

    if (this.props.onFileChosen) {
      this.props.onFileChosen({ file, path: file.path || file.name });
    }
    this.fileInput.current.value = null; // clear the file input
  };

  handleDirectoryInputSelection = () => {
    this.setState({ selectionError: undefined });
    let defaultPath;
    let properties;
    let isWin = process.platform === 'win32';
    let type = this.props.type;

    if (isWin === true) {
      defaultPath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    }

    if (type === 'openFile') {
      properties = ['openFile'];
    }

    if (type === 'openDirectory') {
      properties = ['openDirectory'];
    }

    remote.dialog
      .showOpenDialog({
        properties,
        defaultPath,
        filters: this.props.filters,
      })
      .then((result) => {
        const path = result && !result.canceled && result.filePaths && result.filePaths[0];
        if (path) {
          return ipcRenderer.invoke('get-file-from-path', path, this.props.readFile);
        }
      })
      .then((result) => {
        if (!result) {
          return;
        }
        const file = new File([result.buffer], result.name, {
          type: result.mime,
        });
        this.props.onFileChosen({ file, path: result.path });
      })
      .catch(() => this.setState({ selectionError: __('The selected file or folder could not be opened.') }));
  };

  fileInputButton = () => {
    this.fileInput.current.click();
  };

  input: ?HTMLInputElement;

  render() {
    const { type, currentPath, label, placeholder, accept, error, disabled, autoFocus = false } = this.props;
    const placeHolder = currentPath || placeholder;

    return (
      <React.Fragment>
        <FormField
          label={label}
          webkitdirectory="true"
          className="form-field--with-button"
          error={error || this.state.selectionError}
          disabled={disabled}
          type="text"
          readOnly="readonly"
          value={placeHolder || __('Choose a file')}
          inputButton={
            <Button
              autoFocus={autoFocus}
              button="primary"
              disabled={disabled}
              onClick={
                type === 'openDirectory' || type === 'openFile'
                  ? this.handleDirectoryInputSelection
                  : this.fileInputButton
              }
              label={__('Browse')}
            />
          }
        />
        <input
          type={'file'}
          style={{ display: 'none' }}
          accept={accept}
          ref={this.fileInput}
          onChange={() => (type === 'openDirectory' ? () => {} : this.handleFileInputSelection())}
          webkitdirectory={type === 'openDirectory' ? 'True' : null}
        />
      </React.Fragment>
    );
  }
}

export default FileSelector;
