import { Vector3, Quaternion } from 'three';

export type DeliveryType =
  | 'seam-up'
  | 'outswing'
  | 'inswing'
  | 'legspin'
  | 'offspin'
  | 'topspin'
  | 'googly';

export class BallState {
  position = new Vector3();
  velocity = new Vector3();
  angularVelocity = new Vector3(); // rad/s, right-hand rule
  seamAxis = new Vector3(0, 1, 0); // unit vector: the seam's "pole", fixed in world space for seam-presentation bowling
  orientation = new Quaternion(); // visual spin orientation, integrated from angularVelocity
  wear = 0; // 0 = brand new, ~1 = fully worn/rough
  hasBounced = false;
  bounceCount = 0;
  isDead = false;
  deliveryType: DeliveryType = 'seam-up';

  reset(): void {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.seamAxis.set(0, 1, 0);
    this.orientation.identity();
    this.hasBounced = false;
    this.bounceCount = 0;
    this.isDead = false;
  }
}
