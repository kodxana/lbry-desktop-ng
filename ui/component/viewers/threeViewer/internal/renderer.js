import { WebGLRenderer, SRGBColorSpace } from 'three';

const ThreeRenderer = ({ antialias, shadowMap }) => {
  const renderer = new WebGLRenderer({ antialias });
  // Renderer configuration
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = shadowMap || false;
  renderer.shadowMap.autoUpdate = false;
  return renderer;
};

export default ThreeRenderer;
