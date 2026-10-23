const { spawnSync } = require('child_process');
const path = require('path');

for (const file of [
  'testLintTooling.js',
  'testFlowTooling.js',
  'testFlowContracts.js',
  'testDependencyTypes.js',
  'testDependencyContracts.js',
  'testRemainingDependencyContracts.js',
  'testAccountClient.js',
  'testArtifactDownload.js',
  'testYaml.js',
  'testBuildHelpers.js',
  'testBundleAnalysis.js',
  'testCompiler.js',
  'testDesktopRoutes.js',
  'testDesktopHistory.js',
  'testDesktopSetup.js',
  'testDesktopUpdates.js',
  'testUpdaterIpc.js',
  'testPasswordStorage.js',
  'testCookies.js',
  'testDevServer.js',
  'testFileSelection.js',
  'testWindowControls.js',
  'testRendererLifecycle.js',
  'testContextMenu.js',
  'testDesktopInfo.js',
  'testTranslationCollection.js',
  'testWalletBackup.js',
  'testDesktopBridge.js',
  'testContentFiles.js',
]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', timeout: 120000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
