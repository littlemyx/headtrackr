import { PerspectiveCamera, Vector3, Object3D } from "three";

function isCustomEvent(event: Event): event is CustomEvent {
  return "detail" in event;
}

/**
 * Optional controllers for handling headtrackr events
 *
 * @author auduno / github.com/auduno
 */

// NB! made for three.js revision 48. May not work with other revisions.

/**
 * Controls a THREE.js camera to create pseudo-3D effect
 *
 * Needs the position of "screen" in 3d-model to be given up front, and to be static (i.e. absolute) during headtracking
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} scaling The scaling of the "screen" in the 3d model.
 *   This is the vertical size of screen in 3d-model relative to vertical size of computerscreen in real life
 * @param {array} fixedPosition array with attributes x,y,z, position of "screen" in 3d-model
 * @param {THREE.Vector3} lookAt the object/position the camera should be pointed towards
 * @param {object} params optional object with optional parameters
 *
 * Optional parameters:
 *   screenHeight : vertical size of computer screen (default is 20 cm, i.e. typical laptop size)
 */
export const realisticAbsoluteCameraControl = (
  camera: PerspectiveCamera,
  scaling: number,
  fixedPosition: number[],
  lookAt: Vector3,
  params: { damping: number; screenHeight?: number }
) => {
  const screenHeightCms = params.screenHeight || 20;

  camera.position.set(
    fixedPosition[0],
    fixedPosition[1],
    fixedPosition[2]
  );
  camera.lookAt(lookAt);

  const wh = screenHeightCms * scaling;
  const ww = wh * camera.aspect;

  document.addEventListener(
    "headtrackingEvent",
    (event: Event) => {
      if (!isCustomEvent(event)) {
        throw new Error("not a custom event");
      }
      const {
        detail: { x, y, z },
      } = event;

      // console.log(`x: ${x} y: ${y} z: ${z}`);
      // update camera
      const xOffset = x > 0 ? 0 : -x * 2 * params.damping * scaling;
      const yOffset = y < 0 ? 0 : y * 2 * params.damping * scaling;
      camera.setViewOffset(
        ww + Math.abs(x * 2 * params.damping * scaling),
        wh + Math.abs(y * params.damping * 2 * scaling),
        xOffset,
        yOffset,
        ww,
        wh
      );

      camera.position.set(
        fixedPosition[0] + x * scaling * params.damping,
        fixedPosition[1] + y * scaling * params.damping,
        fixedPosition[2] + z * scaling
      );

      // update lookAt?

      // TODO do not reassign param field
      // when changing height of window, we need to change field of view
      // eslint-disable-next-line no-param-reassign
      camera.fov =
        (Math.atan(
          (wh / 2 + Math.abs(y * scaling * params.damping)) /
            Math.abs(z * scaling)
        ) *
          360) /
        Math.PI;

      camera.updateProjectionMatrix();
    },
    false
  );
};

/**
 * Controls a THREE.js camera to create pseudo-3D effect
 *
 * Places "screen" in 3d-model in relation to original cameraposition at any given time
 * Currently not sure if this works properly, or at all
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} scaling The scaling of the "screen" in the 3d model.
 *   This is the vertical size of screen in 3d-model relative to vertical size of computerscreen in real life
 * @param {array} relativeFixedDistance how long in front of (or behind) original cameraposition the fixed frame will be
 * @param {object} params optional object with optional parameters
 *
 * Optional parameters:
 *   screenHeight : vertical size of computer screen (default is 20 cm, i.e. typical laptop size)
 */
export const realisticRelativeCameraControl = (
  camera: PerspectiveCamera,
  scaling: number,
  relativeFixedDistance: number,
  params: { screenHeight?: number }
) => {
  // we assume that the parent of camera is the scene

  const screenHeightCms = params.screenHeight || 20;

  const scene = camera.parent;

  // const init = true;

  // create an object to offset camera without affecting existing camera interaction
  const offset = new Object3D();
  offset.position.set(0, 0, 0);
  offset.add(camera);
  scene!.add(offset);

  // TODO : we maybe need to offset functions like lookAt as well
  //	use prototype function replacement for this?

  const wh = screenHeightCms * scaling;
  const ww = wh * camera.aspect;

  // set fov
  document.addEventListener(
    "headtrackingEvent",
    (event: Event) => {
      if (!isCustomEvent(event)) {
        throw new Error("not a custom event");
      }
      const {
        detail: { x, y, z },
      } = event;
      // update camera
      const xOffset = x > 0 ? 0 : -x * 2 * scaling;
      const yOffset = y > 0 ? 0 : -y * 2 * scaling;
      camera.setViewOffset(
        ww + Math.abs(x * 2 * scaling),
        wh + Math.abs(y * 2 * scaling),
        xOffset,
        yOffset,
        ww,
        wh
      );

      offset.setRotationFromEuler(camera.rotation);
      offset.position.set(0, 0, 0);
      offset.translateX(x * scaling);
      offset.translateY(y * scaling);
      offset.translateZ(z * scaling + relativeFixedDistance);

      // offset.position.x = (event.x * scaling);
      // offset.position.y = (event.y * scaling);
      // offset.position.z = (event.z * scaling)+relativeFixedDistance;

      // TODO
      // when changing height of window, we need to change field of view
      // eslint-disable-next-line no-param-reassign
      camera.fov =
        (Math.atan(
          (wh / 2 + Math.abs(y * scaling)) / Math.abs(z * scaling)
        ) *
          360) /
        Math.PI;

      camera.updateProjectionMatrix();
    },
    false
  );
};
