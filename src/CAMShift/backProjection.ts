export default (
  imgData: Uint8ClampedArray,
  idw: number,
  idh: number,
  weights: number[]
): PixelProbability => {
  // Return a matrix representing pixel color probabilities
  const data: PixelProbability = [];
  let x: number;
  let y: number;
  let r: number;
  let g: number;
  let b: number;
  let pos: number;
  let a: number[] = [];

  // TODO : we could use typed arrays here
  // but we should then do a compatibilitycheck

  for (x = 0; x < idw; x++) {
    a = [];
    for (y = 0; y < idh; y++) {
      pos = (y * idw + x) * 4;
      r = imgData[pos] >> 4;
      g = imgData[pos + 1] >> 4;
      b = imgData[pos + 2] >> 4;
      a.push(weights[256 * r + 16 * g + b]);
    }
    data[x] = a;
  }
  return data;
};
