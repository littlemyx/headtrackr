export default (
  data: PixelProbability,
  x: number,
  y: number,
  w: number,
  h: number,
  second: boolean
): Moments => {
  const moments: Moments = {
    m00: 0,
    m01: 0,
    m10: 0,
    m11: 0,
    m02: 0,
    m20: 0,
    invM00: 0,
    xc: 0,
    yc: 0,
    mu00: 0,
    mu01: 0,
    mu10: 0,
    mu20: 0,
    mu02: 0,
    mu11: 0,
  };

  var i, j, val, vx, vy;
  var a = [];
  for (i = x; i < w; i++) {
    a = data[i];
    vx = i - x;

    for (j = y; j < h; j++) {
      val = a[j];

      vy = j - y;
      moments.m00 += val;
      moments.m01 += vy * val;
      moments.m10 += vx * val;
      if (second) {
        moments.m11 += vx * vy * val;
        moments.m02 += vy * vy * val;
        moments.m20 += vx * vx * val;
      }
    }
  }

  moments.invM00 = 1 / moments.m00;
  moments.xc = moments.m10 * moments.invM00;
  moments.yc = moments.m01 * moments.invM00;
  moments.mu00 = moments.m00;
  moments.mu01 = 0;
  moments.mu10 = 0;
  if (second) {
    moments.mu20 = moments.m20 - moments.m10 * moments.xc;
    moments.mu02 = moments.m02 - moments.m01 * moments.yc;
    moments.mu11 = moments.m11 - moments.m01 * moments.xc;
  }

  return moments;
};
