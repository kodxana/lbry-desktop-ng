// Villain 1.0.9 still calls the animation API from Reakit's 1.0 beta.
import { useMenuState as useCurrentMenuState, useTooltipState as useCurrentTooltipState } from 'reakit';
export {
  Button,
  Menu,
  MenuDisclosure,
  MenuGroup,
  MenuItem,
  MenuItemCheckbox,
  MenuItemRadio,
  MenuSeparator,
  Tooltip,
  TooltipReference,
} from 'reakit';

export function useMenuState({ unstable_animated, ...options }) {
  const state = useCurrentMenuState({ ...options, animated: unstable_animated });
  return { ...state, unstable_stopAnimation: state.stopAnimation };
}

export function useTooltipState({ unstable_animated, ...options }) {
  const state = useCurrentTooltipState({ ...options, animated: unstable_animated });
  return { ...state, unstable_stopAnimation: state.stopAnimation };
}
