// @flow
import * as React from 'react';
import GUI from 'lil-gui';
import { Box3, Vector3, Mesh, PerspectiveCamera, MeshPhongMaterial } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import LoadingScreen from 'component/common/loading-screen';
import desktop from 'util/desktop';
import detectWebGL from './internal/detector';
import ThreeGrid from './internal/grid';
import ThreeScene from './internal/scene';
import ThreeRenderer from './internal/renderer';

type Props = { source: { fileType: string, downloadPath: string } };
type State = { error: ?string, isReady: boolean, isLoading: boolean };

class ThreeViewer extends React.PureComponent<Props, State> {
  state: State = { error: null, isReady: false, isLoading: false };
  materialColor = 0xffffff;
  theme: { showFog: boolean, gridColor: number, centerLineColor: number, backgroundColor: number } = {
    showFog: true,
    gridColor: 0x414e5c,
    centerLineColor: 0x7f8c8d,
    backgroundColor: 0x0b0c0d,
  };
  loadId = 0;
  viewer: ?HTMLElement;
  guiContainer: ?HTMLElement;
  gui: any;
  mesh: any;
  scene: any;
  camera: any;
  frameID: any;
  controls: any;
  material: any;
  renderer: any;
  targetCenter: any;

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
    this.loadSource();
  }

  componentDidUpdate(previous: Props) {
    if (
      previous.source.downloadPath !== this.props.source.downloadPath ||
      previous.source.fileType !== this.props.source.fileType
    ) {
      this.loadSource();
    }
  }

  componentWillUnmount() {
    this.loadId++;
    window.removeEventListener('resize', this.handleResize);
    this.clearScene();
  }

  clearScene() {
    cancelAnimationFrame(this.frameID);
    if (this.gui) this.gui.destroy();
    if (this.controls) this.controls.dispose();
    const geometries = new Set<{ dispose: () => void }>();
    const materials = new Set<{ dispose: () => void }>();
    if (this.material) materials.add(this.material);
    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.geometry) geometries.add(child.geometry);
        if (child.material) {
          for (const material of [].concat(child.material)) materials.add(material);
        }
      });
    }
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
    this.gui = this.controls = this.renderer = this.scene = this.mesh = this.material = this.camera = null;
    this.frameID = this.targetCenter = null;
  }

  async loadSource(): Promise<void> {
    const request = ++this.loadId;
    this.clearScene();
    this.setState({ isLoading: true, isReady: false, error: null });
    try {
      const { fileType, downloadPath } = this.props.source;
      if (!['stl', 'obj'].includes(fileType)) throw new Error('Unsupported model');
      // Read only a file authorized by the main process, preserving Unicode and # in paths.
      const bytes = await desktop.readDocument(downloadPath);
      if (request !== this.loadId) return;
      if (!detectWebGL()) {
        this.setState({
          isLoading: false,
          error: __('3D preview requires WebGL 2. Open this file in a 3D application.'),
        });
        return;
      }
      this.renderScene();
      if (fileType === 'stl') {
        const geometry = new STLLoader().parse(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        );
        geometry.center();
        geometry.rotateX(-Math.PI / 2);
        this.mesh = new Mesh(geometry, this.material);
      } else {
        // Parsing OBJ bytes does not fetch referenced MTL files or textures.
        this.mesh = new OBJLoader().parse(new TextDecoder().decode(bytes));
      }
      this.scene.add(this.mesh);
      let meshes = 0;
      this.mesh.traverse((child) => {
        if (!child.isMesh) return;
        meshes++;
        const positions = child.geometry.getAttribute('position');
        if (!positions || positions.count < 3 || !positions.array.every(Number.isFinite)) {
          throw new Error('Invalid model');
        }
        // Replace removed Geometry.mergeVertices while retaining smooth-shading controls.
        child.geometry.deleteAttribute('normal');
        const indexed = mergeVertices(child.geometry);
        child.geometry.dispose();
        child.geometry = indexed;
        indexed.computeVertexNormals();
        if (indexed.hasAttribute('color')) this.material.vertexColors = true;
        if (child.material !== this.material) {
          for (const material of [].concat(child.material)) material.dispose();
        }
        child.material = this.material;
      });
      if (!meshes) throw new Error('Empty model');
      ThreeViewer.fitMeshToCamera(this.mesh);
      this.targetCenter = new Box3().setFromObject(this.mesh).getCenter(new Vector3());
      this.updateControlsTarget(this.targetCenter);
      this.createInterfaceControls();
      this.setState({ isReady: true, isLoading: false });
    } catch (_) {
      if (request !== this.loadId) return;
      this.clearScene();
      this.setState({ isReady: false, isLoading: false, error: __("Sorry, looks like we can't load this file") });
    }
  }

  static fitMeshToCamera(group: any): void {
    const box = new Box3().setFromObject(group);
    const size = box.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    if (box.isEmpty() || !Number.isFinite(extent) || extent <= 0) throw new Error('Empty model');
    const center = box.getCenter(new Vector3());
    const scale = 10 / extent;
    group.scale.setScalar(scale);
    group.position.copy(center).multiplyScalar(-scale);
    group.position.y += (size.y * scale) / 2;
  }

  createInterfaceControls() {
    if (this.guiContainer && this.mesh) {
      this.gui = new GUI({ container: this.guiContainer, title: 'Controls', closeFolders: true });

      const config: { color: number, reset: () => void } = {
        color: this.materialColor,
        reset: () => {
          // Reset material color
          config.color = this.materialColor;
          // Reset material
          this.material.color.set(config.color);
          this.material.flatShading = true;
          this.material.needsUpdate = true;
          this.material.shininess = 30;
          this.material.wireframe = false;
          // Reset autoRotate
          this.controls.autoRotate = false;
          // Reset camera
          this.restoreCamera();
        },
      };

      const materialFolder = this.gui.addFolder('Material');

      // Color picker
      const colorPicker = materialFolder.addColor(config, 'color').name('Color').listen();

      colorPicker.onChange((color) => {
        this.material.color.set(color);
      });

      materialFolder.add(this.material, 'shininess', 0, 100).name('Shininess').listen();

      materialFolder
        .add(this.material, 'flatShading')
        .name('FlatShading')
        .onChange(() => {
          this.material.needsUpdate = true;
        })
        .listen();

      materialFolder.add(this.material, 'wireframe').name('Wireframe').listen();

      const sceneFolder = this.gui.addFolder('Scene');

      sceneFolder.add(this.controls, 'autoRotate').name('Auto-Rotate').listen();

      sceneFolder.add(config, 'reset').name('Reset');
    }
  }

  handleResize = () => {
    const viewer = this.viewer;
    if (!viewer || !this.renderer) return;
    const width = Math.max(1, viewer.clientWidth);
    const height = Math.max(1, viewer.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  updateControlsTarget(point: any) {
    this.controls.target.copy(point);
    this.controls.update();
  }

  restoreCamera() {
    this.controls.reset();
    this.camera.position.set(-9.5, 14, 11);
    this.updateControlsTarget(this.targetCenter);
  }

  renderScene() {
    this.renderer = ThreeRenderer({ antialias: true, shadowMap: true });
    this.scene = ThreeScene(this.theme);
    this.scene.add(ThreeGrid({ size: 100, ...this.theme }));
    this.camera = new PerspectiveCamera(80, 1, 0.1, 1000);
    this.camera.position.set(-9.5, 14, 11);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.75;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 14;
    this.controls.enablePan = false;
    this.controls.saveState();
    this.material = new MeshPhongMaterial({ flatShading: true, color: this.materialColor });
    this.handleResize();
    if (this.viewer) this.viewer.appendChild(this.renderer.domElement);
    const updateScene = () => {
      this.frameID = requestAnimationFrame(updateScene);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    updateScene();
  }

  render(): React.Node {
    const { error, isReady, isLoading } = this.state;
    return (
      <div className="file-render__viewer file-render__viewer--three">
        <div
          ref={(element) => {
            this.guiContainer = element;
          }}
          className="gui-container"
        />
        <div
          className="three-viewer"
          ref={(viewer) => {
            this.viewer = viewer;
          }}
        >
          {error && <LoadingScreen status={error} spinner={false} />}
          {isLoading && !error && !isReady && <LoadingScreen status={__('Loading 3D model.')} spinner />}
        </div>
      </div>
    );
  }
}

export default ThreeViewer;
