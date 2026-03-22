import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Dev-only: load a GLB from /assets/terrain/ (no Supabase). */
@Component({
  selector: 'app-terrain-local-preview',
  templateUrl: './terrain-local-preview.component.html',
  styleUrls: ['./terrain-local-preview.component.css'],
})
export class TerrainLocalPreviewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Served as http://localhost:4200/assets/terrain/<file> */
  readonly glbAssetPath = 'assets/terrain/lions_course.glb';

  status = 'Loading…';
  error: string | null = null;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private frameId: number | null = null;

  ngAfterViewInit(): void {
    this.initThree();
    this.loadGlb();
  }

  ngOnDestroy(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
    this.controls?.dispose();
    this.renderer?.dispose();
    this.scene?.clear();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.renderer || !this.camera || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87aade);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500000);
    this.camera.position.set(0, 400, 800);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    // Large terrain meshes: cap DPR so fill-rate doesn’t tank FPS
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.setSize(w, h, false);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    // Oblique sun + fill — readable relief (similar idea to shaded + EDL in desktop viewers)
    this.scene.add(new THREE.AmbientLight(0xc8d4e8, 0.32));
    this.scene.add(new THREE.HemisphereLight(0xb8c9e8, 0x3a3d42, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(400, 220, 350);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35);
    fill.position.set(-280, 120, -200);
    this.scene.add(fill);

    const tick = () => {
      this.frameId = requestAnimationFrame(tick);
      this.controls?.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    tick();
  }

  private loadGlb(): void {
    if (!this.scene || !this.camera) return;

    const loader = new GLTFLoader();
    loader.load(
      this.glbAssetPath,
      (gltf) => {
        const root = gltf.scene;
        this.applyTerrainMaterials(root);
        this.scene!.add(root);

        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        root.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const dist = maxDim * 1.2;
        this.camera!.position.set(dist * 0.6, dist * 0.45, dist * 0.9);
        this.camera!.near = maxDim * 0.001;
        this.camera!.far = maxDim * 100;
        this.camera!.lookAt(0, 0, 0);
        this.camera!.updateProjectionMatrix();

        this.controls?.target.set(0, 0, 0);
        this.controls?.update();

        this.status = `Loaded (${this.glbAssetPath}) — drag to orbit, scroll to zoom`;
      },
      (ev) => {
        if (ev.total) {
          this.status = `Loading ${Math.round((ev.loaded / ev.total) * 100)}%`;
        }
      },
      (err) => {
        this.error =
          err instanceof Error ? err.message : String(err);
        this.status = 'Failed';
      }
    );
  }

  /**
   * Lit terrain (MeshStandard + recomputed normals) for relief; vertex colors = albedo.
   * Drop any GLB normals first — bad tangents from export were causing flat/black shading.
   */
  private applyTerrainMaterials(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }
      const mesh = obj as THREE.Mesh;
      const geom = mesh.geometry as THREE.BufferGeometry;
      const hasVc = !!geom.getAttribute('color');
      if (geom.getAttribute('normal')) {
        geom.deleteAttribute('normal');
      }
      geom.computeVertexNormals();

      const mat = hasVc
        ? new THREE.MeshStandardMaterial({
            vertexColors: true,
            color: 0xffffff,
            metalness: 0.02,
            roughness: 0.82,
            flatShading: true,
          })
        : new THREE.MeshStandardMaterial({
            color: 0x7a9470,
            metalness: 0.02,
            roughness: 0.85,
            flatShading: true,
          });
      const old = mesh.material;
      mesh.material = mat;
      if (Array.isArray(old)) {
        old.forEach((m) => {
          if (m && typeof (m as THREE.Material).dispose === 'function') {
            (m as THREE.Material).dispose();
          }
        });
      } else if (old && typeof (old as THREE.Material).dispose === 'function') {
        (old as THREE.Material).dispose();
      }
    });
  }
}
