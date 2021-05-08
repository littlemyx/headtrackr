/* eslint-disable no-bitwise */
import Rectangle from "../Common/Rectangle";

import Histogram from "./Histogram";

import calculateMoments from "./moments";
import TrackObject from "../TrackObject";

const meanShift = (
  frame: ImageData,
  pdf: PixelProbability,
  searchWindow: Rectangle
): { moments: Moments; newSearchWindow: Rectangle } => {
  // mean-shift algorithm on frame

  const w = frame.width;
  const h = frame.height;

  const newSearchWindow = new Rectangle(searchWindow);

  let moments!: Moments;

  let x;
  let y;
  let i;
  let wadx;
  let wady;
  let wadw;
  let wadh;

  const meanShiftIterations = 10; // maximum number of iterations

  // store initial searchwindow
  let prevx = newSearchWindow.x;
  let prevy = newSearchWindow.y;

  // Locate by iteration the maximum of density into the probability distributions
  for (i = 0; i < meanShiftIterations; i += 1) {
    // get searchwindow from pdf:
    wadx = Math.max(newSearchWindow.x, 0);
    wady = Math.max(newSearchWindow.y, 0);
    wadw = Math.min(wadx + newSearchWindow.width, w);
    wadh = Math.min(wady + newSearchWindow.height, h);

    moments = calculateMoments(
      pdf,
      wadx,
      wady,
      wadw,
      wadh,
      i === meanShiftIterations - 1
    );
    x = moments.xc;
    y = moments.yc;

    newSearchWindow.x += (x - newSearchWindow.width / 2) >> 0;
    newSearchWindow.y += (y - newSearchWindow.height / 2) >> 0;

    // if we have reached maximum density, get second moments and stop iterations
    if (newSearchWindow.x === prevx && newSearchWindow.y === prevy) {
      moments = calculateMoments(pdf, wadx, wady, wadw, wadh, true);
      break;
    } else {
      prevx = newSearchWindow.x;
      prevy = newSearchWindow.y;
    }
  }

  newSearchWindow.x = Math.max(0, Math.min(newSearchWindow.x, w));
  newSearchWindow.y = Math.max(0, Math.min(newSearchWindow.y, h));

  return { moments, newSearchWindow };
};

type CamshiftResult = {
  trackObject: ITrackObject;
  searchWindow: Rectangle;
};

export default (
  frame: ImageData,
  modelHist: Histogram,
  globalSearchWindow: Rectangle,
  pdf: PixelProbability,
  shouldCalcAngles: boolean = true
): CamshiftResult => {
  const trackObj: ITrackObject = new TrackObject();
  const w = frame.width;
  const h = frame.height;
  const searchWindow = globalSearchWindow.clone();

  // search location
  const {
    moments,
    newSearchWindow,
  }: { moments: Moments; newSearchWindow: Rectangle } = meanShift(
    frame,
    pdf,
    searchWindow
  );

  const a = moments.mu20 * moments.invM00;
  const c = moments.mu02 * moments.invM00;

  if (shouldCalcAngles) {
    // use moments to find size and orientation
    const b = moments.mu11 * moments.invM00;
    const d = a + c;
    const e = Math.sqrt(4 * b * b + (a - c) * (a - c));

    // update object position
    trackObj.width = Math.sqrt((d - e) * 0.5) << 2;
    trackObj.height = Math.sqrt((d + e) * 0.5) << 2;
    trackObj.angle = Math.atan2(2 * b, a - c + e);

    // to have a positive counter clockwise angle
    if (trackObj.angle < 0) trackObj.angle += Math.PI;
  } else {
    trackObj.width = Math.sqrt(a) << 2;
    trackObj.height = Math.sqrt(c) << 2;
    trackObj.angle = Math.PI / 2;
  }

  // check if tracked object is into the limit
  trackObj.x = Math.floor(
    Math.max(
      0,
      Math.min(newSearchWindow.x + newSearchWindow.width / 2, w)
    )
  );
  trackObj.y = Math.floor(
    Math.max(
      0,
      Math.min(newSearchWindow.y + newSearchWindow.height / 2, h)
    )
  );

  trackObj.time = new Date().getTime() - trackObj.time;

  // new search window size
  newSearchWindow.width = Math.floor(1.1 * trackObj.width);
  newSearchWindow.height = Math.floor(1.1 * trackObj.height);

  return { trackObject: trackObj, searchWindow: newSearchWindow };
};
