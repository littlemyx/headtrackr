/* eslint-disable no-bitwise */
/**
 * Smoother for smoothing tracked positions of face
 *
 * Double Exponential Smoothing-based Prediction
 *	 see: http://www.cs.brown.edu/people/jjl/pubs/kfvsexp_final_laviola.pdf
 *	 "Double Exponential Smoothing: An alternative to Kalman Filter-based Predictive Tracking"
 *
 * @author auduno / github.com/auduno
 * @param {number} a Smoothing parameter, between 0 and 1. 0 is max smoothing, 1 no smoothing.
 * @param {number} interval The ms interval between tracking events
 * @constructor
 */

interface Position {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}

export default class Smoother {
  private sPosition: number[] = [];

  private sPosition2: number[] = [];

  private sLength: number = 0;

  private interpolate: boolean = false;

  private alpha: number;

  private interval: number;

  public initialized: boolean = false;

  constructor(alpha: number, interval: number) {
    this.alpha = alpha;
    this.interval = interval;
  }

  init = (initialPosition: Position) => {
    this.initialized = true;
    this.sPosition = [
      initialPosition.x,
      initialPosition.y,
      initialPosition.z,
      initialPosition.width,
      initialPosition.height,
    ];
    this.sPosition2 = this.sPosition;
    this.sLength = this.sPosition.length;
  };

  smooth = (position: Position): Position => {
    const positions = [
      position.x,
      position.y,
      position.z,
      position.width,
      position.height,
    ];

    if (!this.initialized) {
      throw new Error("Smoother is not initialized");
    }

    // update
    for (let i = 0; i < this.sLength; i += 1) {
      this.sPosition[i] =
        this.alpha * positions[i] +
        (1 - this.alpha) * this.sPosition[i];
      this.sPosition2[i] =
        this.alpha * this.sPosition[i] +
        (1 - this.alpha) * this.sPosition2[i];
    }

    // set time
    const updateTime = new Date();

    const msDiff = new Date().getDate() - updateTime.getDate();
    const newPositions = this.predict(msDiff);

    return {
      x: newPositions[0],
      y: newPositions[1],
      z: newPositions[2],
      width: newPositions[3],
      height: newPositions[4],
    };
  };

  predict = (timeDiff: number) => {
    const returnPosition: number[] = [];

    if (this.interpolate) {
      const step = timeDiff / this.interval;
      const stepLo = step >> 0;
      const ratio = this.alpha / (1 - this.alpha);

      const a = (step - stepLo) * ratio;
      const b = 2 + stepLo * ratio;
      const c = 1 + stepLo * ratio;

      for (let i = 0; i < this.sLength; i += 1) {
        returnPosition[i] =
          a * (this.sPosition[i] - this.sPosition2[i]) +
          b * this.sPosition[i] -
          c * this.sPosition2[i];
      }
    } else {
      const step = (timeDiff / this.interval) >> 0;
      const ratio = (this.alpha * step) / (1 - this.alpha);
      const a = 2 + ratio;
      const b = 1 + ratio;
      for (let i = 0; i < this.sLength; i += 1) {
        returnPosition[i] =
          a * this.sPosition[i] - b * this.sPosition2[i];
      }
    }

    return returnPosition;
  };
}
