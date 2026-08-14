import * as THREE from 'three';
import type { TimeOfDay } from '../cricket/Types';

export interface SkyPreset {
  zenith: THREE.Color;
  horizon: THREE.Color;
  sunColor: THREE.Color;
  sunDir: THREE.Vector3;
  cloudTint: THREE.Color;
  cloudOpacity: number;
  starVisibility: number;
}

export const SKY_PRESETS: Record<TimeOfDay, SkyPreset> = {
  day: {
    zenith: new THREE.Color(0x2f6fd0),
    horizon: new THREE.Color(0xbfd9ee),
    sunColor: new THREE.Color(0xfff3d8),
    sunDir: new THREE.Vector3(-0.45, 0.75, -0.35).normalize(),
    cloudTint: new THREE.Color(0xffffff),
    cloudOpacity: 0.85,
    starVisibility: 0,
  },
  twilight: {
    zenith: new THREE.Color(0x2a3566),
    horizon: new THREE.Color(0xe8935a),
    sunColor: new THREE.Color(0xffc27a),
    sunDir: new THREE.Vector3(-0.85, 0.18, -0.25).normalize(),
    cloudTint: new THREE.Color(0xf7c9a0),
    cloudOpacity: 0.8,
    starVisibility: 0.15,
  },
  night: {
    zenith: new THREE.Color(0x050914),
    horizon: new THREE.Color(0x101c30),
    sunColor: new THREE.Color(0x223355),
    sunDir: new THREE.Vector3(0.3, 0.6, 0.4).normalize(),
    cloudTint: new THREE.Color(0x2a3850),
    cloudOpacity: 0.5,
    starVisibility: 0.9,
  },
};

function makeSkyTexture(preset: SkyPreset): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  // Equirect gradient: top of texture = zenith.
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, `#${preset.zenith.getHexString()}`);
  g.addColorStop(0.55, `#${preset.horizon.clone().lerp(preset.zenith, 0.35).getHexString()}`);
  g.addColorStop(0.75, `#${preset.horizon.getHexString()}`);
  g.addColorStop(1, `#${preset.horizon.getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);

  // Sun: project sun dir into equirect space.
  const d = preset.sunDir;
  const u = (Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5) * 1024;
  const v = (0.5 - Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) / Math.PI) * 512;
  const sun = ctx.createRadialGradient(u, v, 0, u, v, 90);
  const sc = preset.sunColor;
  sun.addColorStop(0, `rgba(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)},0.95)`);
  sun.addColorStop(0.12, `rgba(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)},0.5)`);
  sun.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);

  // Stars (night).
  if (preset.starVisibility > 0.01) {
    let seed = 1234;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 420; i++) {
      const x = rnd() * 1024;
      const y = rnd() * 300;
      const a = rnd() * preset.starVisibility * (1 - y / 340);
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 26; i++) {
    const x = 30 + rnd() * 196;
    const y = 40 + rnd() * 48;
    const r = 14 + rnd() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sky {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshBasicMaterial;
  private readonly clouds: THREE.Sprite[] = [];

  constructor(preset: SkyPreset, weather: 'clear' | 'overcast' | 'humid' = 'clear') {
    if (weather === 'overcast') {
      preset = { ...preset, cloudOpacity: 1, cloudTint: preset.cloudTint.clone().multiplyScalar(0.72) };
    } else if (weather === 'humid') {
      preset = { ...preset, cloudOpacity: 0.95, cloudTint: preset.cloudTint.clone().multiplyScalar(0.88) };
    }
    this.group.name = 'sky';
    const domeMat = new THREE.MeshBasicMaterial({
      map: makeSkyTexture(preset),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(880, 48, 24), domeMat);
    dome.renderOrder = -100;
    this.group.add(dome);
    this.material = domeMat;

    const cloudTex = makeCloudTexture();
    let seed = preset.starVisibility > 0.5 ? 31 : 13;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const cloudCount = weather === 'clear' ? 10 : 24;
    for (let i = 0; i < cloudCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        color: preset.cloudTint,
        transparent: true,
        opacity: preset.cloudOpacity * (0.5 + rnd() * 0.5),
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const angle = rnd() * Math.PI * 2;
      const radius = 350 + rnd() * 350;
      sprite.position.set(Math.cos(angle) * radius, 120 + rnd() * 130, Math.sin(angle) * radius);
      const s = 120 + rnd() * 160;
      sprite.scale.set(s, s * 0.42, 1);
      this.group.add(sprite);
      this.clouds.push(sprite);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += dt * (1.2 + (i % 5) * 0.35);
      if (c.position.x > 750) c.position.x = -750;
    }
  }
}
