export default (canvas: HTMLCanvasElement): number => {
  // returns average gray value in canvas

  let avggray;
  let avgr;
  let avgb;
  let avgg;

  const canvasContext = canvas.getContext("2d");
  const image = canvasContext.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  const id = image.data;
  const imagesize = image.width * image.height;
  let r = 0;
  let g = 0;
  let b = 0;

  for (var i = 0; i < imagesize; i++) {
    r += id[4 * i];
    g += id[4 * i + 1];
    b += id[4 * i + 2];
  }

  avgr = r / imagesize;
  avgg = g / imagesize;
  avgb = b / imagesize;
  avggray = (avgr + avgg + avgb) / 3;

  return avggray;
};
