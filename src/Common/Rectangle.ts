/**
 * rectangle object
 *
 * @constructor
 */
export default class Rectangle implements IRectangle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  clone = (): Rectangle => {
    return new Rectangle(this.x, this.y, this.width, this.height);
  };
}
