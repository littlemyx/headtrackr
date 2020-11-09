import Rectangle from "../Common/Rectangle";

import Histogram from "./Histogram";

import calculateMoments from "./moments";

const meanShift = (
  frame: ImageData,
  pdf: PixelProbability,
  searchWindow: Rectangle
): { moments: Moments; newSearchWindow: Rectangle } => {
  // mean-shift algorithm on frame

  const w = frame.width;
  const h = frame.height;

  let moments: Moments;

  var x, y, i, wadx, wady, wadw, wadh;

  var meanShiftIterations = 10; // maximum number of iterations

  // store initial searchwindow
  var prevx = searchWindow.x;
  var prevy = searchWindow.y;

  // Locate by iteration the maximum of density into the probability distributions
  for (i = 0; i < meanShiftIterations; i++) {
    // get searchwindow from pdf:
    wadx = Math.max(searchWindow.x, 0);
    wady = Math.max(searchWindow.y, 0);
    wadw = Math.min(wadx + searchWindow.width, w);
    wadh = Math.min(wady + searchWindow.height, h);

    moments = calculateMoments(
      pdf,
      wadx,
      wady,
      wadw,
      wadh,
      i == meanShiftIterations - 1
    );
    x = moments.xc;
    y = moments.yc;

    searchWindow.x += (x - searchWindow.width / 2) >> 0;
    searchWindow.y += (y - searchWindow.height / 2) >> 0;

    // if we have reached maximum density, get second moments and stop iterations
    if (searchWindow.x == prevx && searchWindow.y == prevy) {
      moments = calculateMoments(pdf, wadx, wady, wadw, wadh, true);
      break;
    } else {
      prevx = searchWindow.x;
      prevy = searchWindow.y;
    }
  }

  searchWindow.x = Math.max(0, Math.min(searchWindow.x, w));
  searchWindow.y = Math.max(0, Math.min(searchWindow.y, h));

  return { moments, newSearchWindow: searchWindow };
};

export default (
  frame: ImageData,
  modelHist: Histogram,
  globalSearchWindow: Rectangle,
  pdf: PixelProbability,
  shouldCalcAngles: boolean = true
): TrackObject => {
  const trackObj: TrackObject = {
    width: null,
    height: null,
    x: null,
    y: null,
    angle: null,
    confidence: 1,
    time: new Date().getTime(),
    detection: DetectionTypes.CS,
  };
  let w = frame.width;
  let h = frame.height;
  let searchWindow = globalSearchWindow.clone();

  // search location
  let {
    moments,
    newSearchWindow,
  }: { moments: Moments; newSearchWindow: Rectangle } = meanShift(
    frame,
    pdf,
    searchWindow
  );

  var a = moments.mu20 * moments.invM00;
  var c = moments.mu02 * moments.invM00;

  if (shouldCalcAngles) {
    // use moments to find size and orientation
    var b = moments.mu11 * moments.invM00;
    var d = a + c;
    var e = Math.sqrt(4 * b * b + (a - c) * (a - c));

    // update object position
    trackObj.width = Math.sqrt((d - e) * 0.5) << 2;
    trackObj.height = Math.sqrt((d + e) * 0.5) << 2;
    trackObj.angle = Math.atan2(2 * b, a - c + e);

    // to have a positive counter clockwise angle
    if (trackObj.angle < 0) trackObj.angle = trackObj.angle + Math.PI;
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

  return trackObj;
};
