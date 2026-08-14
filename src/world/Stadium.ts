import * as THREE from 'three';
import { BOUNDARY_RADIUS } from '../core/Constants';
import type { TimeOfDay } from '../cricket/Types';

const SPONSORS = ['KRIKET', 'STUMPS', 'COVER DRIVE', 'YORKER', 'WILLOW', 'SEAM', 'GULLY', 'SLOG', 'APPEAL', 'BAILS', 'DRIVE', 'SWING'];

function makeAdTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = fg;
  ctx.font = 'bold 44px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Stadium {
  readonly group = new THREE.Group();
  readonly floodlightHeads: THREE.Mesh[] = [];
  private readonly screenCanvas: HTMLCanvasElement;
  private readonly screenTex: THREE.CanvasTexture;

  constructor(time: TimeOfDay, boundary = BOUNDARY_RADIUS) {
    this.group.name = 'stadium';

    const concrete = new THREE.MeshStandardMaterial({ color: 0x66707c, roughness: 0.9 });
    const concreteDark = new THREE.MeshStandardMaterial({ color: 0x525c68, roughness: 0.92 });
    const seatBlue = new THREE.MeshStandardMaterial({ color: 0x27435e, roughness: 0.85 });

    // ── Two raked tiers of steps ringing the ground ────────────────────────
    // Tier radii/heights match the Crowd distribution bands.
    const stepMat = [concrete, concreteDark];
    for (let tier = 0; tier < 2; tier++) {
      const baseR = tier === 0 ? 75 : 95;
      const baseY = tier === 0 ? 1.6 : 14.5;
      const rows = tier === 0 ? 10 : 9;
      for (let row = 0; row < rows; row++) {
        const r = baseR + row * 2.05;
        const h = baseY + row * 1.25;
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(r + 1.15, r + 1.15, 0.95, 96, 1, true),
          stepMat[(row + tier) % 2],
        );
        ring.position.y = h - 0.475;
        this.group.add(ring);
        const floor = new THREE.Mesh(new THREE.RingGeometry(r - 1.05, r + 1.15, 96), seatBlue);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = h;
        this.group.add(floor);
      }
      // Back wall of the tier.
      const backR = baseR + rows * 2.05;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(backR, backR, 4.2, 96, 1, true), concreteDark);
      wall.position.y = baseY + rows * 1.25 + 2.1;
      this.group.add(wall);
    }

    // ── Roof ring over the upper tier ──────────────────────────────────────
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.6, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.RingGeometry(97, 118, 96, 1, 0, Math.PI * 2), roofMat);
    roof.rotation.x = -Math.PI / 2;
    roof.rotation.z = 0.0;
    roof.position.y = 29.5;
    roof.scale.set(1, 1, 1);
    (roof.geometry as THREE.RingGeometry).computeVertexNormals();
    roof.castShadow = time !== 'day';
    this.group.add(roof);
    const fascia = new THREE.Mesh(new THREE.CylinderGeometry(118, 118, 1.6, 96, 1, true), concreteDark);
    fascia.position.y = 28.8;
    this.group.add(fascia);

    // ── Sightscreens at both ends (behind the bowler's arm) ────────────────
    const sightMat = new THREE.MeshStandardMaterial({
      color: 0xf2f2ea,
      roughness: 0.85,
      emissive: time === 'night' ? new THREE.Color(0x9aa8b8) : new THREE.Color(0x000000),
      emissiveIntensity: time === 'night' ? 0.5 : 0,
    });
    for (const end of [-1, 1]) {
      const sight = new THREE.Mesh(new THREE.BoxGeometry(14, 4.4, 0.3), sightMat);
      sight.position.set(0, 2.2, end * (boundary + 6));
      this.group.add(sight);
    }

    // ── Floodlight masts ───────────────────────────────────────────────────
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.5, metalness: 0.6 });
    const lampOn = time === 'night';
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c1c,
      emissive: lampOn ? new THREE.Color(0xf4f8ff) : new THREE.Color(0x000000),
      emissiveIntensity: lampOn ? 2.4 : 0,
      roughness: 0.3,
    });
    for (let k = 0; k < 6; k++) {
      const angle = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(angle) * 112;
      const z = Math.sin(angle) * 112;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 52, 10), poleMat);
      pole.position.set(x, 26, z);
      this.group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 0.8), poleMat);
      head.position.set(x, 52.5, z);
      head.lookAt(0, 0, 0);
      this.group.add(head);
      // 3x2 lamp grid, emissive at night
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), lampMat);
          lamp.position.set((i - 1) * 1.6, (j - 0.5) * 1.5, 0.45);
          head.add(lamp);
        }
      }
      this.floodlightHeads.push(head);
    }

    // ── Boundary advertising boards ────────────────────────────────────────
    const boardGeo = new THREE.BoxGeometry(6.4, 0.95, 0.12);
    const bgs = ['#0b3d91', '#c21807', '#0b7a3d', '#e8a010', '#5c0b91', '#e8e8e8'];
    const fgs = ['#ffffff', '#ffffff', '#ffffff', '#101010', '#ffffff', '#c21807'];
    const nBoards = Math.floor((Math.PI * 2 * (boundary + 2.6)) / 6.6);
    for (let i = 0; i < nBoards; i++) {
      const angle = (i / nBoards) * Math.PI * 2;
      // Leave gaps for the sightscreens.
      const deg = THREE.MathUtils.radToDeg(angle);
      if (Math.abs(deg - 90) < 9 || Math.abs(deg - 270) < 9) continue;
      const bi = i % bgs.length;
      const tex = makeAdTexture(SPONSORS[i % SPONSORS.length], bgs[bi], fgs[bi]);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
      const board = new THREE.Mesh(boardGeo, mat);
      board.position.set(Math.cos(angle) * (boundary + 2.6), 0.48, Math.sin(angle) * (boundary + 2.6));
      board.rotation.y = -angle - Math.PI / 2;
      this.group.add(board);
    }

    // ── Big screen (live score, canvas texture) ────────────────────────────
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 288;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(17, 9.6), screenMat);
    screen.position.set(58, 17, -58);
    screen.lookAt(0, 4, 0);
    this.group.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(18.4, 11, 0.7), concreteDark);
    frame.position.copy(screen.position);
    frame.quaternion.copy(screen.quaternion);
    frame.translateZ(-0.45);
    this.group.add(frame);
    this.setScreenText('KRIKET', 'WELCOME');
  }

  setScreenText(line1: string, line2: string): void {
    const ctx = this.screenCanvas.getContext('2d')!;
    ctx.fillStyle = '#0a1420';
    ctx.fillRect(0, 0, 512, 288);
    ctx.fillStyle = '#36d17c';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(line1, 256, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px Arial';
    ctx.fillText(line2, 256, 220);
    this.screenTex.needsUpdate = true;
  }
}
