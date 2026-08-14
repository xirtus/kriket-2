import * as THREE from 'three';
import { BOUNDARY_RADIUS } from '../core/Constants';

/** Outfield with mow-stripes baked into a radial canvas texture, a rope and a
 *  painted boundary line. The texture is generated once per match. */
export function buildGround(boundaryRadius = BOUNDARY_RADIUS): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ground';

  const size = 2048;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const half = size / 2;
  const worldRadius = boundaryRadius + 18;
  const pxPerM = half / worldRadius;

  // Base green.
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, size, size);

  // Radial mow rings (alternating shades), like a freshly prepared outfield.
  for (let r = worldRadius; r > 0; r -= 4.5) {
    const shade = Math.floor(r / 4.5) % 2 === 0 ? '#2e7f33' : '#2c7a30';
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(half, half, r * pxPerM, 0, Math.PI * 2);
    ctx.fill();
  }

  // The square: a soft, subtly drier strip in the middle (feathered edges).
  const sq = ctx.createRadialGradient(half, half, 2 * pxPerM, half, half, 17 * pxPerM);
  sq.addColorStop(0, 'rgba(160, 145, 95, 0.16)');
  sq.addColorStop(0.75, 'rgba(160, 145, 95, 0.10)');
  sq.addColorStop(1, 'rgba(160, 145, 95, 0)');
  ctx.fillStyle = sq;
  ctx.fillRect(half - 18 * pxPerM, half - 18 * pxPerM, 36 * pxPerM, 36 * pxPerM);

  // Speckle noise so the grass never reads as flat vector fill.
  let seed = 99;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.03)';
    ctx.fillRect(x, y, 2, 2);
  }

  // 30-yard circle (dashed white) and boundary line.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 0.18 * pxPerM;
  ctx.setLineDash([1.4 * pxPerM, 1.4 * pxPerM]);
  ctx.beginPath();
  ctx.arc(half, half, 27.4 * pxPerM, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 0.32 * pxPerM;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(half, half, boundaryRadius * pxPerM, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const geo = new THREE.CircleGeometry(worldRadius, 128);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  const outfield = new THREE.Mesh(geo, mat);
  outfield.rotation.x = -Math.PI / 2;
  outfield.receiveShadow = true;
  group.add(outfield);

  // Boundary rope.
  const ropeGeo = new THREE.TorusGeometry(boundaryRadius, 0.07, 8, 160);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.55 });
  const rope = new THREE.Mesh(ropeGeo, ropeMat);
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.07;
  group.add(rope);

  return group;
}
