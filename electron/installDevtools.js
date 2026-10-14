export default async function installDevtools() {
  const { installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = require('electron-devtools-installer');

  await installExtension(REACT_DEVELOPER_TOOLS)
    .then(extension => console.log(`Added Extension:  ${extension.name}`))
    .catch(err => console.log('An error occurred: ', err));

  await installExtension(REDUX_DEVTOOLS)
    .then(extension => console.log(`Added Extension:  ${extension.name}`))
    .catch(err => console.log('An error occurred: ', err));
}
