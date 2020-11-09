import getWhitebalance from "./whitebalance";

interface Params {
  sendEvents: boolean;
  whitebalancing: boolean;
  debug: HTMLCanvasElement;
  calcAngles: boolean;
  Camshift: ICamshit;
}

export default class Tracker {
  private params: Params;
  private currentDetectionType: DetectionTypes;

  private _inputcanvas: HTMLCanvasElement;
  private _curtracked;
  private _cstracker;
  private _confidenceThreshold: number = -10; // needed confidence before switching to Camshift
  private previousWhitebalances: number[] = []; // array of previous 10 whitebalance values
  private pwbLength: number = 15;

  constructor(params: Params) {
    this.params = {
      sendEvents: true,
      whitebalancing: true,
      debug: null,
      calcAngles: false,
      ...params,
    };
    this.currentDetectionType = params.whitebalancing
      ? DetectionTypes.WB
      : DetectionTypes.VJ;
  }

  init = (inputCanvas: HTMLCanvasElement) => {
    this._inputcanvas = inputCanvas;
  };

  track = () => {
    let result: TrackObject;
    switch (true) {
      case this.currentDetectionType == DetectionTypes.WB: {
        result = this.checkWhitebalance();
        break;
      }
      case this.currentDetectionType == DetectionTypes.VJ: {
        result = this.doVJDetection();
        break;
      }
      case this.currentDetectionType == DetectionTypes.CS: {
        result = this.doCSDetection();
        break;
      }
      default: {
        break;
      }
    }
    
  };

  // Whitebalancing
  checkWhitebalance = (): TrackObject => {
    let result: TrackObject;
    // get whitebalance value
    result.wb = getWhitebalance(this._inputcanvas);
    result.detection = DetectionTypes.WB;

    return result;
  };

  doVJDetection = (): TrackObject => {
    return {
      width: null,
      height: null,
      x: null,
      y: null,
      angle: null,
      confidence: null,
      time: null,
      detection: DetectionTypes.VJ,
    };
  };

  doCSDetection = (): TrackObject => {
    // detect
    const csresult = this.params.Camshift.track(this._inputcanvas);

    // if debugging, draw backprojection image on debuggingcanvas
    if (this.params.debug) {
      this.params.debug
        .getContext("2d")
        .putImageData(
          this.params.Camshift.getBackProjectionImg(),
          0,
          0
        );
    }

    return csresult;
  };
}
