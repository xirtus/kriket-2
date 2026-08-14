import * as THREE from 'three';

/** Ball trail + bounce dust + flying bails: the small physical touches that sell impact. */
export class BallTrail {
  readonly line: THREE.Points;
  private readonly capacity = 110;
  private readonly positions: Float32Array;
  private head = 0;
  private count = 0;
  active = false;
  private readonly mat: THREE.PointsMaterial;

  constructor() {
    this.positions = new Float32Array(this.capacity * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.PointsMaterial({
      color: 0xff7a52,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.line = new THREE.Points(geo, this.mat);
    this.line.frustumCulled = false;
    this.line.visible = false;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.line.visible = false;
    this.active = false;
  }

  push(p: THREE.Vector3): void {
    if (!this.active) {
      this.active = true;
      this.line.visible = true;
    }
    // Only record every other physics step so the trail spans a readable arc.
    this.positions[this.head * 3] = p.x;
    this.positions[this.head * 3 + 1] = p.y;
    this.positions[this.head * 3 + 2] = p.z;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    const attr = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    this.line.geometry.setDrawRange(0, this.count);
  }
}

interface Puff {
  sprite: THREE.Sprite;
  t: number;
}

export class DustPuffs {
  readonly group = new THREE.Group();
  private readonly puffs: Puff[] = [];
  private readonly tex: THREE.CanvasTexture;

  constructor() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(214,190,150,0.85)');
    g.addColorStop(1, 'rgba(214,190,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.tex = new THREE.CanvasTexture(c);
  }

  spawn(pos: THREE.Vector3, scale = 1): void {
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, opacity: 0.8, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.position.y = Math.max(0.12, pos.y);
    sprite.scale.setScalar(0.4 * scale);
    this.group.add(sprite);
    this.puffs.push({ sprite, t: 0 });
  }

  update(dt: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.t += dt;
      const k = p.t / 0.55;
      p.sprite.scale.setScalar(0.4 + k * 1.6);
      (p.sprite.material as THREE.SpriteMaterial).opacity = 0.8 * (1 - k);
      p.sprite.position.y += dt * 0.5;
      if (k >= 1) {
        this.group.remove(p.sprite);
        p.sprite.material.dispose();
        this.puffs.splice(i, 1);
      }
    }
  }
}

/** Bails knocked flying, with tiny rigid-body arcs, reset each ball. */
export class BailPhysics {
  private readonly items: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; home: THREE.Vector3; live: boolean }[] = [];

  constructor(stumpsGroups: THREE.Group[]) {
    for (const g of stumpsGroups) {
      for (const child of g.children) {
        if (child.name.startsWith('bail')) {
          this.items.push({
            mesh: child as THREE.Mesh,
            vel: new THREE.Vector3(),
            spin: new THREE.Vector3(),
            home: child.position.clone(),
            live: false,
          });
        }
      }
    }
  }

  disturb(worldPoint: THREE.Vector3, ballVel: THREE.Vector3): void {
    for (const it of this.items) {
      const wp = new THREE.Vector3();
      it.mesh.getWorldPosition(wp);
      if (wp.distanceTo(worldPoint) < 0.45) {
        it.live = true;
        it.vel.set(
          ballVel.x * 0.12 + (Math.random() - 0.5) * 2,
          2.2 + Math.random() * 2.4,
          ballVel.z * 0.12 + (Math.random() - 0.5) * 2,
        );
        it.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      }
    }
  }

  reset(): void {
    for (const it of this.items) {
      it.live = false;
      it.mesh.position.copy(it.home);
      it.mesh.rotation.set(0, 0, Math.PI / 2);
    }
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (!it.live) continue;
      it.vel.y -= 9.81 * dt;
      it.mesh.position.addScaledVector(it.vel, dt);
      it.mesh.rotation.x += it.spin.x * dt;
      it.mesh.rotation.y += it.spin.y * dt;
      if (it.mesh.position.y < 0.02) {
        it.mesh.position.y = 0.02;
        it.vel.multiplyScalar(0.3);
        it.vel.y = Math.abs(it.vel.y) * 0.3;
        if (it.vel.length() < 0.4) it.live = false;
      }
    }
  }
}
