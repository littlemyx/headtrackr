import getWhitebalance from "./whitebalance";
import Rectangle from "../Common/Rectangle";
import CAMShift from "../CAMShift/index";
import { detectObjects, grayscale } from "../ccv";
import cascade from "../cascade";
import TrackObject from "../TrackObject";
import { DetectionTypesEnum } from "../DetectionTypes";

interface Params {
  canvasElement?: HTMLCanvasElement;
  sendEvents?: boolean;
  whitebalancing?: boolean;
  debug?: boolean;
  debugCanvas?: HTMLCanvasElement; // TODO make sure that it exists
  calcAngles?: boolean;
  Camshift?: ICamshit;
}

export default class Tracker {
  private params: Params;

  private currentDetectionType: DetectionTypes;

  private _inputcanvas: HTMLCanvasElement;

  private _curtracked: ITrackObject = new TrackObject();

  private _cstracker: ICamshit;

  private _confidenceThreshold: number = -10; // needed confidence before switching to Camshift

  private previousWhitebalances: number[] = []; // array of previous 10 whitebalance values

  private pwbLength: number = 15;

  constructor(inputCanvas: HTMLCanvasElement, params: Params) {
    this.params = {
      sendEvents: true,
      whitebalancing: true,
      debug: false,
      calcAngles: false,
      ...params,
    };

    this._inputcanvas = inputCanvas;

    // initialize cs tracker
    this._cstracker = new CAMShift({
      calcAngles: this.params.calcAngles,
    });

    this.currentDetectionType = params.whitebalancing
      ? DetectionTypesEnum.WB
      : DetectionTypesEnum.VJ;
  }

  track = () => {
    let result: ITrackObject = new TrackObject();

    switch (true) {
      case this.currentDetectionType === DetectionTypesEnum.WB: {
        result = this.checkWhitebalance();
        break;
      }
      case this.currentDetectionType === DetectionTypesEnum.VJ: {
        result = this.doVJDetection();
        break;
      }
      case this.currentDetectionType === DetectionTypesEnum.CS: {
        result = this.doCSDetection();
        break;
      }
      default: {
        break;
      }
    }

    if (result.detection === DetectionTypesEnum.WB) {
      if (this.previousWhitebalances.length >= this.pwbLength) {
        this.previousWhitebalances.pop();
      }
      if (this.previousWhitebalances.length === this.pwbLength) {
        const max = Math.max.apply(null, this.previousWhitebalances);
        const min = Math.min.apply(null, this.previousWhitebalances);

        // if difference between the last ten whitebalances is less than 2,
        //   we assume whitebalance is stable
        if (max - min < 2) {
          // switch to facedetection
          this.currentDetectionType = DetectionTypesEnum.VJ;
        }
      }
    }

    // check if Viola-Jones has found a viable face
    if (
      result.detection === DetectionTypesEnum.VJ &&
      result.confidence > this._confidenceThreshold
    ) {
      // switch to Camshift
      this.currentDetectionType = DetectionTypesEnum.CS;
      // when switching, we initalize camshift with current found face
      const cRectangle = new Rectangle({
        x: Math.floor(result.x),
        y: Math.floor(result.y),
        width: Math.floor(result.width),
        height: Math.floor(result.height),
      });
      this._cstracker.initTracker(this._inputcanvas, cRectangle);
    }

    this._curtracked = result;

    if (
      result.detection === DetectionTypesEnum.CS &&
      this.params.sendEvents
    ) {
      // send events
      const evt = new CustomEvent("facetrackingEvent", {
        detail: {
          height: result.height,
          width: result.width,
          angle: result.angle,
          x: result.x,
          y: result.y,
          confidence: result.confidence,
          detection: result.detection,
          time: result.time,
        },
      });

      document.dispatchEvent(evt);
    }
  };

  getTrackingObject = () => {
    return this._curtracked.clone();
  };

  // Whitebalancing
  checkWhitebalance = (): ITrackObject => {
    const result: ITrackObject = new TrackObject();
    // get whitebalance value
    result.wb = getWhitebalance(this._inputcanvas);
    result.detection = DetectionTypesEnum.WB;

    return result;
  };

  doVJDetection = (): ITrackObject => {
    const start = new Date().getTime();

    // we seem to have to copy canvas to avoid interference with camshift
    // not entirely sure why
    // TODO: ways to avoid having to copy canvas every time

    const ccvCanvas = document.createElement("canvas");

    ccvCanvas.width = this._inputcanvas.width;
    ccvCanvas.height = this._inputcanvas.height;

    ccvCanvas
      .getContext("2d")!
      .drawImage(
        this._inputcanvas,
        0,
        0,
        ccvCanvas.width,
        ccvCanvas.height
      );

    const comp = detectObjects(grayscale(ccvCanvas), cascade, 5, 1);

    const diff = new Date().getTime() - start;

    // loop through found faces and pick the most likely one
    // TODO: check amount of neighbors and size as well?
    // TODO: choose the face that is most in the center of canvas?
    let candidate: IPoint = {} as IPoint;
    if (comp.length > 0) {
      [candidate] = comp;
    }
    if (candidate.confidence !== undefined) {
      for (let i = 1; i < comp.length; i += 1) {
        if (comp[i].confidence > candidate.confidence) {
          candidate = comp[i];
        }
      }
    }

    // copy information from ccv object to a new trackObj
    const result: ITrackObject = new TrackObject({
      width: candidate.width,
      height: candidate.height,
      x: candidate.x,
      y: candidate.y,
      angle: 0,
      confidence: candidate.confidence,
      time: diff,
      detection: DetectionTypesEnum.VJ,
    });

    return result;
  };

  doCSDetection = (): ITrackObject => {
    const start = new Date().getTime();
    // detect
    const csresult = this._cstracker.track(this._inputcanvas);
    // this._cstracker.getTrackObj();

    // if debugging, draw backprojection image on debuggingcanvas
    if (this.params.debug) {
      this.params
        .debugCanvas!.getContext("2d")!
        .putImageData(this._cstracker.getBackProjectionImg(), 0, 0);
    }

    // end timing
    const diff = new Date().getTime() - start;

    // copy information from CS object to a new trackObj
    const result = new TrackObject();
    result.width = csresult.width;
    result.height = csresult.height;
    result.x = csresult.x;
    result.y = csresult.y;
    // TODO: should we adjust this angle to be "clockwise"?
    result.angle = csresult.angle;
    // TODO: camshift should pass along some sort of confidence?
    result.confidence = 1;

    // copy timing to object
    result.time = diff;
    result.detection = DetectionTypesEnum.CS;

    return result;
  };
}
