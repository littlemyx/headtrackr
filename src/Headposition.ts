import TrackObject from "./TrackObject";

/**
 * Calculates an estimate of the position of the head of the user in relation to screen or camera
 *   based on input from facetrackrObject
 *
 * Usage:
 *	var hp = new headtrackr.headposition.Tracker(facetrackrObject, 640, 480);
 *	var currentPosition = hp.track(facetrackrObject);
 *
 * @author auduno / github.com/auduno
 */
interface Params {
  edgecorrection?: boolean;
  fov?: number;
  distanceToScreen?: number;
  distanceFromCameraToScreen?: number;
}
/**
 *
 * Parameters to Tracker() are:
 *	facetrackrObject : a generic object with attributes x, y, width, height, angle
 *		which describe the position of center of detected face
 *	camwidth : width of canvas where the face was detected
 *	camheight : height of canvas where the face was detected
 *
 * Optional parameters can be passed along like this:
 *	 headtrackr.headposition.Tracker(facetrackrObject, 640, 480, {fov : 60})
 *
 * Optional parameters:
 *	 fov {number} : horizontal field of view of camera (default is to detect via distance to screen, any fov overrides distance_to_screen)
 *	 distance_to_screen {number} : initial distance from face to camera, in cms (default is 60 cm)
 *	 edgecorrection {boolean} : whether to use heuristic for position of head when detection is on the edge of the screen (default is true)
 *	 distance_from_camera_to_screen : distance from camera to center of screen (default is 11.5 cm, typical for laptops)
 *
 * Returns a generic object with attributes x, y, z which is estimated headposition in cm in relation to center of screen
 *
 * @constructor
 */
export default class Headposition {
  private params: Params;

  private camHeightCam: number;

  private camWidthCam: number;

  // holds current position of head (in cms from center of screen)
  private x: number = 0;

  private y: number = 0;

  private z: number = 0;

  private fovWidth: number;

  private headDiagCm: number;

  private sinHsa: number;

  private cosHsa: number;

  private tanHsa: number;

  private tanFovWidth: number;

  private headDiagCam: number;

  constructor(
    facetrackrObj: ITrackObject,
    camwidth: number,
    camheight: number,
    params: Params = {}
  ) {
    // some assumptions that are used when calculating distances and estimating horizontal fov
    //	 head width = 16 cm
    //	 head height = 19 cm
    //	 when initialized, user is approximately 60 cm from camera

    this.params = {
      edgecorrection: true,
      ...params,
    };

    this.camHeightCam = camheight;
    this.camWidthCam = camwidth;

    const headWidthCm = 16;
    const headHeightCm = 19;

    // angle between side of face and diagonal across
    const headSmallAngle = Math.atan(headWidthCm / headHeightCm);

    this.headDiagCm = Math.sqrt(
      headWidthCm * headWidthCm + headHeightCm * headHeightCm
    ); // diagonal of face in real space

    this.sinHsa = Math.sin(headSmallAngle); // precalculated sine
    this.cosHsa = Math.cos(headSmallAngle); // precalculated cosine
    this.tanHsa = Math.tan(headSmallAngle); // precalculated tan

    // estimate horizontal field of view of camera
    const initWidthCam = facetrackrObj.width;
    const initHeightCam = facetrackrObj.height;
    this.headDiagCam = Math.sqrt(
      initWidthCam * initWidthCam + initHeightCam * initHeightCam
    );

    if (params.fov === undefined) {
      // we use the diagonal of the faceobject to estimate field of view of the camera
      // we use the diagonal since this is less sensitive to errors in width or height
      const headWidthCam = this.sinHsa * this.headDiagCam;
      const camwidthAtDefaultFaceCm =
        (this.camWidthCam / headWidthCam) * headWidthCm;
      // we assume user is sitting around 60 cm from camera (normal distance on a laptop)

      let distanceToScreen: number;
      if (this.params.distanceToScreen === undefined) {
        distanceToScreen = 60;
      } else {
        distanceToScreen = this.params.distanceToScreen;
      }
      // calculate estimate of field of view
      this.fovWidth =
        Math.atan(camwidthAtDefaultFaceCm / 2 / distanceToScreen) * 2;
    } else {
      this.fovWidth = (params.fov * Math.PI) / 180;
    }

    // precalculate ratio between camwidth and distance
    this.tanFovWidth = 2 * Math.tan(this.fovWidth / 2);
  }

  track = (facetrackrObj: ITrackObject) => {
    const w = facetrackrObj.width;
    const h = facetrackrObj.height;
    let fx = facetrackrObj.x;
    let fy = facetrackrObj.y;

    if (this.params.edgecorrection) {
      // recalculate head_diag_cam, fx, fy

      const margin = 11;

      const leftDistance = fx - w / 2;
      const rightDistance = this.camWidthCam - (fx + w / 2);
      const topDistance = fy - h / 2;
      const bottomDistance = this.camHeightCam - (fy + h / 2);

      const onVerticalEdge =
        leftDistance < margin || rightDistance < margin;
      const onHorizontalEdge =
        topDistance < margin || bottomDistance < margin;

      if (onHorizontalEdge) {
        if (onVerticalEdge) {
          // we are in a corner, use previous diagonal as estimate, i.e. don't change head_diag_cam
          const onLeftEdge = leftDistance < margin;
          const onTopEdge = topDistance < margin;

          if (onLeftEdge) {
            fx = w - (this.headDiagCam * this.sinHsa) / 2;
          } else {
            fx = fx - w / 2 + (this.headDiagCam * this.sinHsa) / 2;
          }

          if (onTopEdge) {
            fy = h - (this.headDiagCam * this.cosHsa) / 2;
          } else {
            fy = fy - h / 2 + (this.headDiagCam * this.cosHsa) / 2;
          }
        } else if (topDistance < margin) {
          // we are on top or bottom edge of camera, use width instead of diagonal and correct y-position
          // fix fy

          const originalWeight = topDistance / margin;
          const estimateWeight = (margin - topDistance) / margin;
          fy =
            h -
            (originalWeight * (h / 2) +
              estimateWeight * (w / this.tanHsa / 2));
          this.headDiagCam =
            estimateWeight * (w / this.sinHsa) +
            originalWeight * Math.sqrt(w * w + h * h);
        } else {
          const originalWeight = bottomDistance / margin;
          const estimateWeight = (margin - bottomDistance) / margin;
          fy =
            fy -
            h / 2 +
            (originalWeight * (h / 2) +
              estimateWeight * (w / this.tanHsa / 2));
          this.headDiagCam =
            estimateWeight * (w / this.sinHsa) +
            originalWeight * Math.sqrt(w * w + h * h);
        }
      } else if (onVerticalEdge) {
        // we are on side edges of camera, use height and correct x-position
        if (leftDistance < margin) {
          const originalWeight = leftDistance / margin;
          const estimateWeight = (margin - leftDistance) / margin;
          this.headDiagCam =
            estimateWeight * (h / this.cosHsa) +
            originalWeight * Math.sqrt(w * w + h * h);
          fx =
            w -
            (originalWeight * (w / 2) +
              estimateWeight * ((h * this.tanHsa) / 2));
        } else {
          const originalWeight = rightDistance / margin;
          const estimateWeight = (margin - rightDistance) / margin;
          this.headDiagCam =
            estimateWeight * (h / this.cosHsa) +
            originalWeight * Math.sqrt(w * w + h * h);
          fx =
            fx -
            w / 2 +
            (originalWeight * (w / 2) +
              estimateWeight * ((h * this.tanHsa) / 2));
        }
      } else {
        this.headDiagCam = Math.sqrt(w * w + h * h);
      }
    } else {
      this.headDiagCam = Math.sqrt(w * w + h * h);
    }

    // calculate cm-distance from screen
    this.z =
      (this.headDiagCm * this.camWidthCam) /
      (this.tanFovWidth * this.headDiagCam);
    // to transform to z_3ds : z_3ds = (head_diag_3ds/head_diag_cm)*z
    // i.e. just use ratio

    // calculate cm-position relative to center of screen
    this.x =
      -(fx / this.camWidthCam - 0.5) * this.z * this.tanFovWidth;
    this.y =
      -(fy / this.camHeightCam - 0.5) *
      this.z *
      this.tanFovWidth *
      (this.camHeightCam / this.camWidthCam);

    // Transformation from position relative to camera, to position relative to center of screen
    if (this.params.distanceFromCameraToScreen === undefined) {
      // default is 11.5 cm approximately
      this.y += 11.5;
    } else {
      this.y += this.params.distanceFromCameraToScreen;
    }

    // send off event
    const evt = new CustomEvent("headtrackingEvent", {
      detail: {
        x: this.x,
        y: this.y,
        z: this.z,
      },
    });

    document.dispatchEvent(evt);

    return new TrackObject({ x: this.x, y: this.y, z: this.z });
  };

  getTrackerObj = () => {
    return new TrackObject({ x: this.x, y: this.y, z: this.z });
  };

  getFOV = () => {
    return (this.fovWidth * 180) / Math.PI;
  };
}
