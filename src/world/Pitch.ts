import * as THREE from 'three';
import { PITCH_LENGTH, PITCH_WIDTH, POPPING_CREASE_FROM_STUMPS, RETURN_CREASE_HALF_WIDTH } from '../core/Constants';
import type { PitchId } from '../cricket/Types';

export const BOWLER_STUMPS_Z = -PITCH_LENGTH / 2;
export const STRIKER_STUMPS_Z = PITCH_LENGTH / 2;

interface PitchLook {
  base: string;
  dry: string;
  grassTinge: string;
  footmarkAlpha: number;
  cracks: boolean;
}

const LOOKS: Record<PitchId, PitchLook> = {
  green_seamer: { base: '#b9a86e', dry: '#a5945c', grassTinge: 'rgba(90,140,70,0.30)', footmarkAlpha: 0.12, cracks: false },
  dry_turner: { base: '#c9a76e', dry: '#b08d54', grassTinge: 'rgba(120,120,60,0.08)', footmarkAlpha: 0.3, cracks: true },
  flat_batting: { base: '#d3bd85', dry: '#c4ab72', grassTinge: 'rgba(120,140,70,0.10)', footmarkAlpha: 0.14, cracks: false },
  damp_english: { base: '#a89a68', dry: '#97885a', grassTinge: 'rgba(80,130,70,0.24)', footmarkAlpha: 0.16, cracks: false },
};

/**
 * The strip, with every crease marking, wear pattern and (on dry surfaces) cracks
 * baked into a single canvas texture so the pitch reads as turf, not geometry.
 */
export function buildPitch(pitchId: PitchId = 'flat_batting'): THREE.Group {
  const group = new THREE.Group();
  group.name = 'pitch';

  const look = LOOKS[pitchId];
  const stripLength = PITCH_LENGTH + 8;
  const W = 256;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const pxPerMx = W / (PITCH_WIDTH + 2.2);
  const pxPerMz = H / stripLength;
  const toX = (x: number): number => W / 2 + x * pxPerMx;
  const toY = (z: number): number => H / 2 - z * pxPerMz;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, look.dry);
  grad.addColorStop(0.5, look.base);
  grad.addColorStop(1, look.dry);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  let seed = pitchId.length * 7717;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // Grass tinge at the ends (live grass on green pitches).
  ctx.fillStyle = look.grassTinge;
  ctx.fillRect(0, 0, W, H * 0.16);
  ctx.fillRect(0, H * 0.84, W, H * 0.16);

  // Mottle + wear.
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(60,40,20,0.03)';
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + rnd() * 5, 1 + rnd() * 3, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bowlers' footmarks: scuffed dark patches just in front of each popping crease.
  for (const stumpsZ of [BOWLER_STUMPS_Z, STRIKER_STUMPS_Z]) {
    const dir = stumpsZ < 0 ? 1 : -1;
    for (let i = 0; i < 60; i++) {
      const x = toX((rnd() - 0.5) * 1.4 + dir * 0.55);
      const y = toY(stumpsZ + dir * (POPPING_CREASE_FROM_STUMPS + rnd() * 1.4));
      ctx.fillStyle = `rgba(96,74,44,${look.footmarkAlpha * (0.5 + rnd() * 0.8)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + rnd() * 6, 2 + rnd() * 4, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cracks on dry surfaces.
  if (look.cracks) {
    ctx.strokeStyle = 'rgba(70,50,26,0.4)';
    for (let i = 0; i < 22; i++) {
      ctx.lineWidth = 0.6 + rnd() * 0.8;
      ctx.beginPath();
      let x = rnd() * W;
      let y = rnd() * H;
      ctx.moveTo(x, y);
      const segs = 3 + Math.floor(rnd() * 4);
      for (let sgm = 0; sgm < segs; sgm++) {
        x += (rnd() - 0.5) * 26;
        y += (rnd() - 0.5) * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Crease markings.
  ctx.strokeStyle = 'rgba(250,250,245,0.96)';
  ctx.lineWidth = 2.2;
  const line = (x1: number, z1: number, x2: number, z2: number): void => {
    ctx.beginPath();
    ctx.moveTo(toX(x1), toY(z1));
    ctx.lineTo(toX(x2), toY(z2));
    ctx.stroke();
  };
  for (const stumpsZ of [BOWLER_STUMPS_Z, STRIKER_STUMPS_Z]) {
    const dir = stumpsZ < 0 ? 1 : -1;
    const popZ = stumpsZ + dir * POPPING_CREASE_FROM_STUMPS;
    // Popping crease
    line(-RETURN_CREASE_HALF_WIDTH, popZ, RETURN_CREASE_HALF_WIDTH, popZ);
    // Bowling crease (through the stumps)
    line(-RETURN_CREASE_HALF_WIDTH, stumpsZ, RETURN_CREASE_HALF_WIDTH, stumpsZ);
    // Return creases (joining popping past bowling crease)
    line(-RETURN_CREASE_HALF_WIDTH, popZ, -RETURN_CREASE_HALF_WIDTH, stumpsZ - dir * 1.2);
    line(RETURN_CREASE_HALF_WIDTH, popZ, RETURN_CREASE_HALF_WIDTH, stumpsZ - dir * 1.2);
    // Wide-ball guidelines (0.89m from centre stump)
    line(-0.89, popZ, -0.89, stumpsZ);
    line(0.89, popZ, 0.89, stumpsZ);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const geo = new THREE.PlaneGeometry(PITCH_WIDTH + 2.2, stripLength);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0 });
  const strip = new THREE.Mesh(geo, mat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.012;
  strip.receiveShadow = true;
  group.add(strip);

  return group;
}
