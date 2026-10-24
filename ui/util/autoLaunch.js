import desktop from './desktop';
export const launcher = {
  isEnabled: () => desktop.autoLaunch('isEnabled'),
  enable: () => desktop.autoLaunch('enable'),
  disable: () => desktop.autoLaunch('disable'),
};
