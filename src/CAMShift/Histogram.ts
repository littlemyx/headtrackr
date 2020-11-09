/**
 * RGB histogram
 *
 * @constructor
 */
export default class Histogram {
  private bins: number[] = [];
  private size: number;

  constructor(imgdata: Uint8ClampedArray) {
    this.size = 4096;

    let i;
    let x;
    let r;
    let g;
    let b;
    let il;

    //initialize bins
    for (i = 0; i < this.size; i++) {
      this.bins.push(0);
    }

    //add histogram data
    for (x = 0, il = imgdata.length; x < il; x += 4) {
      r = imgdata[x + 0] >> 4; // round down to bins of 16
      g = imgdata[x + 1] >> 4;
      b = imgdata[x + 2] >> 4;
      this.bins[256 * r + 16 * g + b] += 1;
    }
  }

  static getWeights(mh: Histogram, ch: Histogram): number[] {
    // Return an array of the probabilities of each histogram color bins
    var weights: number[] = [];
    var p;

    // iterate over the entire histogram and compare
    for (var i = 0; i < 4096; i++) {
      if (ch.getBin(i) != 0) {
        p = Math.min(mh.getBin(i) / ch.getBin(i), 1);
      } else {
        p = 0;
      }
      weights.push(p);
    }

    return weights;
  }

  getBin = (index: number) => {
    return this.bins[index];
  };
}
