import { DetectionTypesEnum } from "./DetectionTypes";

type TrackObjectParams = {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  z?: number;
  angle?: number;
  confidence?: number;
  time?: number;
  detection?: DetectionTypes;
  wb?: number;
};

export default class TrackObject implements ITrackObject {
  width: number;

  height: number;

  x: number;

  y: number;

  z: number;

  angle: number;

  confidence: number;

  time: number;

  detection: DetectionTypes;

  wb: number;

  constructor(
    params: Partial<TrackObjectParams> = {
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      z: 0,
      angle: 0,
      confidence: -10000,
      time: 0,
      detection: DetectionTypesEnum.VJ,
      wb: 0,
    } as TrackObjectParams
  ) {
    const {
      width = 0,
      height = 0,
      x = 0,
      y = 0,
      z = 0,
      angle = 0,
      confidence = -10000,
      time = 0,
      detection = DetectionTypesEnum.VJ,
      wb = 0,
    } = params;
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
    this.z = z;
    this.angle = angle;
    this.confidence = confidence;
    this.time = time;
    this.detection = detection;
    this.wb = wb;
  }

  clone = (): TrackObject => new TrackObject(this as TrackObject);
}
