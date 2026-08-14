import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

export class Engine {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: WebGPURenderer;
  readonly clock = new THREE.Clock();
  /** Playback speed multiplier (spectate mode): scales frame dt into the accumulator. */
  timeScale = 1;
  private updateCallbacks: Array<(dt: number, elapsed: number) => void> = [];
  private accumulator = 0;
  private static readonly FIXED_DT = 1 / 120;
  private static readonly MAX_FRAME_DT = 0.25; // absorbs hitches up to 250ms without desync; beyond that we drop time rather than spiral

  private constructor(renderer: WebGPURenderer) {
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(33, window.innerWidth / window.innerHeight, 0.1, 2000);
    window.addEventListener('resize', () => this.onResize());
  }

  static async create(canvas: HTMLCanvasElement): Promise<Engine> {
    const renderer = new WebGPURenderer({ canvas, antialias: true });
    await renderer.init();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87ceeb, 1);
    const engine = new Engine(renderer);
    console.info(`[Engine] renderer backend: ${(renderer as any).backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL fallback'}`);
    return engine;
  }

  onUpdate(cb: (dt: number, elapsed: number) => void): void {
    this.updateCallbacks.push(cb);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      const frameDt = Math.min(this.clock.getDelta(), Engine.MAX_FRAME_DT) * this.timeScale;
      this.accumulator += frameDt;
      while (this.accumulator >= Engine.FIXED_DT) {
        this.stepOnce(Engine.FIXED_DT);
        this.accumulator -= Engine.FIXED_DT;
      }
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** Runs a single fixed-step update without rendering. Exposed so headless/automated testing can fast-forward simulation deterministically instead of depending on real-time rAF cadence (which browsers throttle for backgrounded tabs). */
  stepOnce(dt: number): void {
    for (const cb of this.updateCallbacks) cb(dt, this.clock.elapsedTime);
  }

  renderFrame(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
