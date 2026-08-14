import * as THREE from 'three';
import type { TimeOfDay } from '../cricket/Types';
import { SKY_PRESETS } from './Sky';

export interface LightingRig {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  exposure: number;
}

export function buildLighting(scene: THREE.Scene, time: TimeOfDay): LightingRig {
  const preset = SKY_PRESETS[time];

  const hemi = new THREE.HemisphereLight(
    preset.zenith.clone().lerp(new THREE.Color(0xffffff), 0.55),
    new THREE.Color(0x2f5d34),
    time === 'night' ? 0.34 : time === 'twilight' ? 0.45 : 0.75,
  );
  scene.add(hemi);

  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  let exposure = 1.05;
  if (time === 'day') {
    sun.color.set(0xfff2d8);
    sun.intensity = 3.1;
    sun.position.copy(preset.sunDir).multiplyScalar(140);
    exposure = 1.0;
  } else if (time === 'twilight') {
    sun.color.set(0xffb066);
    sun.intensity = 2.2;
    sun.position.copy(preset.sunDir).multiplyScalar(140);
    exposure = 1.05;
  } else {
    // Night: floodlights become the key light — a tight cool column over the
    // middle plus a faint fill, so the outfield falls off into the dark.
    sun.color.set(0xdce8ff);
    sun.intensity = 2.3;
    sun.position.set(24, 80, 14);
    const fill = new THREE.DirectionalLight(0x8fa8d8, 0.55);
    fill.position.set(-40, 70, -30);
    scene.add(fill);
    exposure = 1.28;
  }
  sun.target.position.set(0, 0, 0);

  return { sun, hemi, exposure };
}
