import * as THREE from 'three';

/**
 * Instanced crowd: thousands of billboard-ish figures on the stands, each with a
 * per-instance colour and animation phase. A vertex-shader bob driven by an
 * `excitement` uniform makes sections surge on wickets and boundaries without
 * touching per-frame CPU instance updates.
 */
export class Crowd {
  readonly mesh: THREE.InstancedMesh;
  private shader: { uniforms: Record<string, { value: number }> } | null = null;
  private excitementTarget = 0.12;

  constructor(count = 9500) {
    const geo = new THREE.PlaneGeometry(0.55, 1.05);
    geo.translate(0, 0.5, 0);

    const phases = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      seeds[i] = Math.random();
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));

    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      sh.uniforms.uExcite = { value: 0.12 };
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uExcite;
           attribute float aPhase;
           attribute float aSeed;
           varying float vSeed;
           varying vec2 vCrowdUv;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vSeed = aSeed;
           vCrowdUv = uv;
           float jump = step(0.72, fract(aSeed * 7.31)) * uExcite;
           transformed.y += max(0.0, sin(uTime * (5.0 + aSeed * 4.0) + aPhase)) * 0.42 * jump;
           transformed.y += sin(uTime * 1.7 + aPhase) * 0.03;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying float vSeed;
           varying vec2 vCrowdUv;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // torso/head shading: darken the top of the quad to read as a head
           diffuseColor.rgb *= 0.75 + 0.25 * smoothstep(0.0, 1.0, vCrowdUv.y);`,
        );
      this.shader = sh;
    };

    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.name = 'crowd';
    this.mesh.frustumCulled = false;

    // Distribute across the two stand tiers built by Stadium (radii/heights must
    // roughly match its step layout).
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();
    let i = 0;
    const palette = [0xd8d3c8, 0xc23b3b, 0x3b62c2, 0x3bc25a, 0xd8c53b, 0xe0e0e0, 0x7a3bc2, 0x2a2a2a, 0xc27a3b, 0x3bc2c2];
    while (i < count) {
      const tier = Math.random() < 0.55 ? 0 : 1;
      const rows = tier === 0 ? 10 : 9;
      const row = Math.floor(Math.random() * rows);
      const r = (tier === 0 ? 75.8 : 95.8) + row * 2.05;
      const y = (tier === 0 ? 2.25 : 15.1) + row * 1.25;
      const angle = Math.random() * Math.PI * 2;
      pos.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      quat.setFromEuler(new THREE.Euler(0, -angle - Math.PI / 2, 0));
      m.compose(pos, quat, scl);
      this.mesh.setMatrixAt(i, m);
      color.setHex(palette[Math.floor(Math.random() * palette.length)]);
      color.offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.12);
      this.mesh.setColorAt(i, color);
      i++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  setExcitement(level: number): void {
    this.excitementTarget = THREE.MathUtils.clamp(level, 0, 1);
  }

  update(dt: number, elapsed: number): void {
    if (!this.shader) return;
    this.shader.uniforms.uTime.value = elapsed;
    const cur = this.shader.uniforms.uExcite.value as number;
    this.shader.uniforms.uExcite.value = cur + (this.excitementTarget - cur) * Math.min(1, dt * 2.5);
  }
}
