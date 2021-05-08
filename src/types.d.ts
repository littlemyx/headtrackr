declare enum StatusMessages {
  whitebalance = "Waiting for camera whitebalancing",
  detecting = "Please wait while camera is detecting your face...",
  hints = "We seem to have some problems detecting your face. Please make sure that your face is well and evenly lighted, and that your camera is working.",
  redetecting = "Lost track of face, trying to detect again..",
  lost = "Lost track of face :(",
  found = "Face found! Move your head!",
}

declare enum SupportMessages {
  "no getUserMedia" = "getUserMedia is not supported in your browser :(",
  "no camera" = "no camera found :(",
}

declare type Messages = StatusMessages | SupportMessages;

type StatusMessagesStrings = keyof typeof StatusMessages;
type SupportMessagesStrings = keyof typeof SupportMessages;

interface HeadtrackrStatusEvent extends Event {
  status: StatusMessagesStrings | SupportMessagesStrings;
}

type PixelProbability = number[][];

type DetectionTypes = "WB" | "CS" | "VJ";

type Moments = {
  m00: number;
  m01: number;
  m10: number;
  m11: number;
  m02: number;
  m20: number;
  invM00: number;
  xc: number;
  yc: number;
  mu00: number;
  mu01: number;
  mu10: number;
  mu20: number;
  mu02: number;
  mu11: number;
};

interface IRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  clone(): IRectangle;
}

interface ITrackObject {
  width: number;
  height: number;
  x: number;
  y: number;
  angle: number;
  confidence: number;
  time: number;
  detection: DetectionTypes;
  wb?: number;
  clone(): ITrackObject;
}
interface IPoint {
  x: number;
  y: number;
  width: number;
  height: number;
  neighbors: number;
  confidence: number;
}

interface ICamshit {
  getSearchWindow(): IRectangle;
  getPixelProbability(): PixelProbability;
  getBackProjectionImg(): ImageData;
  getTrackObj(): ITrackObject;
  initTracker(
    canvas: HTMLCanvasElement,
    trackedArea: IRectangle
  ): void;
  track(canvas: HTMLCanvasElement): ITrackObject;
}

type ClassifierFeature = {
  size: number;
  px: number[];
  py?: number[];
  pz: number[];
  nx: number[];
  ny?: number[];
  nz: number[];
};

type StageClassifier = {
  count: number;
  threshold: number;
  feature: ClassifierFeature[];
  alpha: number[];
};

interface ICascade {
  count: number;
  width: number;
  height: number;
  stage_classifier: StageClassifier[];
}
