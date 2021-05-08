/**
 * camshift object tracker
 *
 * ported with some optimizations from actionscript3 library FaceIt:
 *	 http://www.mukimuki.fr/flashblog/2009/06/18/camshift-going-to-the-source/
 *	 http://www.libspark.org/browser/as3/FaceIt
 * some explanation of algorithm here :
 *	 http://www.cognotics.com/opencv/servo_2007_series/part_3/sidebar.html
 *
 * usage:
 *	 // create a new tracker
 *	 var cstracker = new headtrackr.camshift.Tracker();
 *	 // initialize it with a canvas, and a rectangle around the object on the canvas we'd like to track
 *	 cstracker.initTracker(some_canvas, new headtrackr.camshift.Rectangle(x,y,w,h));
 *	 // find object in same or some other canvas
 *	 cstracker.track(some_canvas);
 *	 // get position of found object
 *	 var currentPos = cstracker.getTrackObj();
 *	 currentPos.x // x-coordinate of center of object on canvas
 *	 currentPos.y // y-coordinate of center of object on canvas
 *	 currentPos.width // width of object
 *	 currentPos.height // heigh of object
 *	 currentPos.angle // angle of object in radians
 *
 * @author Benjamin Jung / jungbenj@gmail.com
 * @author auduno / github.com/auduno
 *
 * License of original actionscript code:
 *
 * Copyright (C)2009 Benjamin Jung
 *
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

import Rectangle from "../Common/Rectangle";
import Histogram from "./Histogram";
import camShift from "./camshiftAlgorithm";
import getBackProjectionData from "./backProjection";
import TrackObject from "../TrackObject";

export default class Camshift implements ICamshit {
  private calcAngle: boolean;

  private _modelHist!: Histogram;

  private _pdf!: PixelProbability; // pixel probability data for current searchwindow

  private _searchWindow!: Rectangle; // rectangle where we are searching

  private _trackObj!: ITrackObject; // object holding data about where current tracked object is

  private _canvasCtx!: CanvasRenderingContext2D; // canvas context for initial canvas

  private _canvasw!: number; // canvas width for tracking canvas

  private _canvash!: number; // canvas height for tracking canvas

  constructor({ calcAngles = true }: { calcAngles?: boolean } = {}) {
    this.calcAngle = calcAngles;
  }

  getSearchWindow = (): Rectangle => {
    // return the search window used by the camshift algorithm in the current analysed image
    return this._searchWindow.clone();
  };

  getTrackObj = () => {
    // return a trackobj with the size and orientation of the tracked object in the current analysed image
    return this._trackObj;
  };

  // ex getPdf
  getPixelProbability = (): PixelProbability => {
    // returns a nested array representing color
    return this._pdf;
  };

  getBackProjectionImg = (): ImageData => {
    // return imgData representing pixel color probabilities, which can then be put into canvas
    const weights = this._pdf;
    const w = this._canvasw;
    const h = this._canvash;
    const img: ImageData = this._canvasCtx.createImageData(w, h);
    const imgData: Uint8ClampedArray = img.data; // TODO не совсем понятно что со ссылкой тут будет
    let x: number;
    let y: number;
    let val: number;
    let pos: number;

    for (x = 0; x < w; x += 1) {
      for (y = 0; y < h; y += 1) {
        val = Math.floor(255 * weights[x][y]);
        pos = (y * w + x) * 4;
        imgData[pos] = val;
        imgData[pos + 1] = val;
        imgData[pos + 2] = val;
        imgData[pos + 3] = 255;
      }
    }
    return img;
  };

  initTracker = (
    canvas: HTMLCanvasElement,
    trackedArea: Rectangle
  ): void => {
    // initialize the tracker with canvas and the area of interest as a rectangle

    this._canvasCtx = canvas.getContext("2d")!;
    const taw = trackedArea.width;
    const tah = trackedArea.height;
    const tax = trackedArea.x;
    const tay = trackedArea.y;
    const trackedImg = this._canvasCtx.getImageData(
      tax,
      tay,
      taw,
      tah
    );

    this._modelHist = new Histogram(trackedImg.data);
    this._searchWindow = trackedArea.clone();
  };

  track = (canvas: HTMLCanvasElement): ITrackObject => {
    // search the tracked object by camshift
    const canvasCtx: CanvasRenderingContext2D = canvas.getContext(
      "2d"
    )!;

    this._canvash = canvas.height;
    this._canvasw = canvas.width;

    const imgData: ImageData = canvasCtx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    let trackObject: ITrackObject = new TrackObject();

    if (imgData.width !== 0 && imgData.height !== 0) {
      const curHist: Histogram = new Histogram(imgData.data);
      const weights: number[] = Histogram.getWeights(
        this._modelHist,
        curHist
      );
      // Color probabilities distributions
      this._pdf = getBackProjectionData(
        imgData.data,
        imgData.width,
        imgData.height,
        weights
      );

      const {
        trackObject: camshiftResult,
        searchWindow: newSearchWindow,
      } = camShift(
        imgData,
        this._modelHist,
        this._searchWindow,
        this._pdf,
        this.calcAngle
      );

      trackObject = camshiftResult;

      this._searchWindow = newSearchWindow;
    }

    // console.log("search window", this._searchWindow);

    return trackObject;
  };
}
