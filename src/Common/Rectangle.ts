/**
 * rectangle object
 *
 * @constructor
 */

type RectangleParams = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};
export default class Rectangle implements IRectangle {
  public x: number;

  public y: number;

  public width: number;

  public height: number;

  constructor(
    params: Partial<RectangleParams> = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    } as RectangleParams
  ) {
    const { x = 0, y = 0, width = 0, height = 0 } = params;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  clone = (): Rectangle => {
    return new Rectangle(this as RectangleParams);
  };
}
