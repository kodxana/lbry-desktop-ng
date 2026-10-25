const detectWebGL = () => {
  // Create canvas element.
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return false;
  const extension = gl.getExtension('WEBGL_lose_context');
  if (extension) extension.loseContext();
  return true;
};

export default detectWebGL;
