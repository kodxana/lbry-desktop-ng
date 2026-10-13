// @flow
import * as React from 'react';
import desktop from 'util/desktop';
import Button from 'component/button';
import { FormField } from 'component/common/form';
import { getFilePath } from 'util/file-path';

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

type State = { selectionError?: string, selecting: boolean };

class FileSelector extends React.PureComponent<Props, State> {
  state = { selectionError: undefined, selecting: false };
  mounted = false;
  selecting = false;
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

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  handleFileInputSelection = () => {
    const { files } = this.fileInput.current;
    if (!files || !files.length) {
      return;
    }

    const file = files[0];

    try {
      const path = getFilePath(file);
      if (!path) throw new Error('The selected file has no local path');
      this.setState({ selectionError: undefined });
      if (this.props.onFileChosen) this.props.onFileChosen({ file, path });
    } catch (_) {
      this.setState({ selectionError: __('The selected file or folder could not be opened.') });
    } finally {
      this.fileInput.current.value = ''; // Allow choosing the same file again.
    }
  };

  handleDirectoryInputSelection = async () => {
    if (this.selecting || this.props.disabled) return;
    this.selecting = true;
    this.setState({ selectionError: undefined, selecting: true });
    try {
      const result = await desktop.selectFile({
        type: this.props.type,
        filters: this.props.filters,
        readFile: this.props.readFile,
      });
      if (!this.mounted) return;
      if (!result.ok) throw new Error('File selection failed');
      if (result.file) {
        const selected = result.file;
        const file = new File([selected.buffer], selected.name, { type: selected.mime });
        this.props.onFileChosen({ file, path: selected.path });
      }
    } catch (_) {
      if (this.mounted) this.setState({ selectionError: __('The selected file or folder could not be opened.') });
    } finally {
      this.selecting = false;
      if (this.mounted) this.setState({ selecting: false });
    }
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
          disabled={disabled || this.state.selecting}
          type="text"
          readOnly="readonly"
          value={placeHolder || __('Choose a file')}
          inputButton={
            <Button
              autoFocus={autoFocus}
              button="primary"
              disabled={disabled || this.state.selecting}
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
