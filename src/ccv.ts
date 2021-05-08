/**
 * Viola-Jones-like face detection algorithm
 * Some explanation here: http://liuliu.me/eyes/javascript-face-detection-explained/
 *
 * @author Liu Liu / github.com/liuliu
 *
 * Copyright (c) 2010, Liu Liu
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * * Neither the name of the authors nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

/* eslint-disable no-bitwise */

export const grayscale = (
  canvas: HTMLCanvasElement
): HTMLCanvasElement => {
  /* detect_objects requires gray-scale image */
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("Provided canvas has no context");
  }
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  const { data } = imageData;
  let pix1;
  let pix2;
  let pix = canvas.width * canvas.height * 4;
  while (pix > 0) {
    pix -= 4;
    pix1 = pix + 1;
    pix2 = pix + 2;
    const newValue =
      data[pix] * 0.3 + data[pix1] * 0.59 + data[pix2] * 0.11;
    data[pix] = newValue;
    data[pix1] = newValue;
    data[pix2] = newValue;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

type Node = {
  parent: number;
  element: IPoint | null;
  rank: number;
};

export const arrayGroup = (
  seq: IPoint[],
  gfunc: (arg0: IPoint, arg1: IPoint) => Boolean
) => {
  let i: number;
  let j: number;
  const node: Node[] = new Array<Node>(seq.length);
  for (i = 0; i < seq.length; i += 1) {
    node[i] = { parent: -1, element: seq[i], rank: 0 };
  }
  for (i = 0; i < seq.length; i += 1) {
    if (node[i].element !== null) {
      let root: number = i;
      while (node[root].parent !== -1) {
        root = node[root].parent;
      }
      for (j = 0; j < seq.length; j += 1) {
        if (
          i !== j &&
          node[j].element &&
          gfunc(node[i].element!, node[j].element!)
        ) {
          let root2 = j;

          while (node[root2].parent !== -1)
            root2 = node[root2].parent;

          if (root2 !== root) {
            if (node[root].rank > node[root2].rank)
              node[root2].parent = root;
            else {
              node[root].parent = root2;
              if (node[root].rank === node[root2].rank)
                node[root2].rank += 1;
              root = root2;
            }

            /* compress path from node2 to the root: */
            let temp;
            let node2 = j;
            while (node[node2].parent !== -1) {
              temp = node2;
              node2 = node[node2].parent;
              node[temp].parent = root;
            }

            /* compress path from node to the root: */
            node2 = i;
            while (node[node2].parent !== -1) {
              temp = node2;
              node2 = node[node2].parent;
              node[temp].parent = root;
            }
          }
        }
      }
    }
  }
  const idx: number[] = new Array(seq.length);
  let classIdx = 0;
  for (i = 0; i < seq.length; i += 1) {
    j = -1;
    let node1 = i;
    if (node[node1].element) {
      while (node[node1].parent !== -1) {
        node1 = node[node1].parent;
      }
      if (node[node1].rank >= 0) {
        const newClassIdx = ~classIdx++;
        node[node1].rank = newClassIdx;
      }
      j = ~node[node1].rank;
    }
    idx[i] = j;
  }
  return { index: idx, cat: classIdx };
};

type Pyr = {
  canvas: HTMLCanvasElement;
  data: Uint8ClampedArray;
};

// ex detect_objects
export const detectObjects = (
  canvas: HTMLCanvasElement,
  cascade: ICascade,
  interval: number,
  minNeighbors: number
): IPoint[] => {
  const scale: number = 2 ** (1 / (interval + 1));
  const next = interval + 1;

  // ex scale_upto

  const scaleUpto = Math.floor(
    Math.log(Math.min(cascade.width, cascade.height)) /
      Math.log(scale)
  );

  const pyr: Pyr[] = new Array((scaleUpto + next * 2) * 4)
    .fill(null)
    .map(() => ({} as Pyr));
  pyr[0].canvas = canvas;

  pyr[0].data = pyr[0]
    .canvas!.getContext("2d")!
    .getImageData(
      0,
      0,
      pyr[0].canvas.width,
      pyr[0].canvas.height
    ).data;
  let i;
  let j;
  let k;
  let x;
  let y;
  let q;
  for (i = 1; i <= interval; i += 1) {
    pyr[i * 4].canvas = document.createElement("canvas");
    pyr[i * 4].canvas.width = Math.floor(
      pyr[0].canvas.width / scale ** i
    );
    pyr[i * 4].canvas.height = Math.floor(
      pyr[0].canvas.height / scale ** i
    );
    pyr[i * 4].canvas
      .getContext("2d")!
      .drawImage(
        pyr[0].canvas,
        0,
        0,
        pyr[0].canvas.width,
        pyr[0].canvas.height,
        0,
        0,
        pyr[i * 4].canvas.width,
        pyr[i * 4].canvas.height
      );
    pyr[i * 4].data = pyr[i * 4].canvas
      .getContext("2d")!
      .getImageData(
        0,
        0,
        pyr[i * 4].canvas.width,
        pyr[i * 4].canvas.height
      ).data;
  }
  for (i = next; i < scaleUpto + next * 2; i += 1) {
    pyr[i * 4].canvas = document.createElement("canvas");
    pyr[i * 4].canvas.width = Math.floor(
      pyr[i * 4 - next * 4].canvas.width / 2
    );
    pyr[i * 4].canvas.height = Math.floor(
      pyr[i * 4 - next * 4].canvas.height / 2
    );
    pyr[i * 4].canvas
      .getContext("2d")!
      .drawImage(
        pyr[i * 4 - next * 4].canvas,
        0,
        0,
        pyr[i * 4 - next * 4].canvas.width,
        pyr[i * 4 - next * 4].canvas.height,
        0,
        0,
        pyr[i * 4].canvas.width,
        pyr[i * 4].canvas.height
      );
    pyr[i * 4].data = pyr[i * 4].canvas
      .getContext("2d")!
      .getImageData(
        0,
        0,
        pyr[i * 4].canvas.width,
        pyr[i * 4].canvas.height
      ).data;
  }
  for (i = next * 2; i < scaleUpto + next * 2; i += 1) {
    pyr[i * 4 + 1].canvas = document.createElement("canvas");
    pyr[i * 4 + 1].canvas.width = Math.floor(
      pyr[i * 4 - next * 4].canvas.width / 2
    );
    pyr[i * 4 + 1].canvas.height = Math.floor(
      pyr[i * 4 - next * 4].canvas.height / 2
    );
    pyr[i * 4 + 1].canvas
      .getContext("2d")!
      .drawImage(
        pyr[i * 4 - next * 4].canvas,
        1,
        0,
        pyr[i * 4 - next * 4].canvas.width - 1,
        pyr[i * 4 - next * 4].canvas.height,
        0,
        0,
        pyr[i * 4 + 1].canvas.width - 2,
        pyr[i * 4 + 1].canvas.height
      );
    pyr[i * 4 + 1].data = pyr[i * 4 + 1].canvas
      .getContext("2d")!
      .getImageData(
        0,
        0,
        pyr[i * 4 + 1].canvas.width,
        pyr[i * 4 + 1].canvas.height
      ).data;
    pyr[i * 4 + 2].canvas = document.createElement("canvas");
    pyr[i * 4 + 2].canvas.width = Math.floor(
      pyr[i * 4 - next * 4].canvas.width / 2
    );
    pyr[i * 4 + 2].canvas.height = Math.floor(
      pyr[i * 4 - next * 4].canvas.height / 2
    );
    pyr[i * 4 + 2].canvas
      .getContext("2d")!
      .drawImage(
        pyr[i * 4 - next * 4].canvas,
        0,
        1,
        pyr[i * 4 - next * 4].canvas.width,
        pyr[i * 4 - next * 4].canvas.height - 1,
        0,
        0,
        pyr[i * 4 + 2].canvas.width,
        pyr[i * 4 + 2].canvas.height - 2
      );
    pyr[i * 4 + 2].data = pyr[i * 4 + 2].canvas
      .getContext("2d")!
      .getImageData(
        0,
        0,
        pyr[i * 4 + 2].canvas.width,
        pyr[i * 4 + 2].canvas.height
      ).data;
    pyr[i * 4 + 3].canvas = document.createElement("canvas");
    pyr[i * 4 + 3].canvas.width = Math.floor(
      pyr[i * 4 - next * 4].canvas.width / 2
    );
    pyr[i * 4 + 3].canvas.height = Math.floor(
      pyr[i * 4 - next * 4].canvas.height / 2
    );
    pyr[i * 4 + 3].canvas
      .getContext("2d")!
      .drawImage(
        pyr[i * 4 - next * 4].canvas,
        1,
        1,
        pyr[i * 4 - next * 4].canvas.width - 1,
        pyr[i * 4 - next * 4].canvas.height - 1,
        0,
        0,
        pyr[i * 4 + 3].canvas.width - 2,
        pyr[i * 4 + 3].canvas.height - 2
      );
    pyr[i * 4 + 3].data = pyr[i * 4 + 3].canvas
      .getContext("2d")!
      .getImageData(
        0,
        0,
        pyr[i * 4 + 3].canvas.width,
        pyr[i * 4 + 3].canvas.height
      ).data;
  }

  let scaleX = 1;
  let scaleY = 1;
  const dx = [0, 1, 0, 1];
  const dy = [0, 0, 1, 1];
  const seq: IPoint[] = [];
  const features: ClassifierFeature[][] = [];
  for (i = 0; i < scaleUpto; i += 1) {
    const qw =
      pyr[i * 4 + next * 8].canvas.width -
      Math.floor(cascade.width / 4);
    const qh =
      pyr[i * 4 + next * 8].canvas.height -
      Math.floor(cascade.height / 4);
    const step = [
      pyr[i * 4].canvas.width * 4,
      pyr[i * 4 + next * 4].canvas.width * 4,
      pyr[i * 4 + next * 8].canvas.width * 4,
    ];
    const paddings = [
      pyr[i * 4].canvas.width * 16 - qw * 16,
      pyr[i * 4 + next * 4].canvas.width * 8 - qw * 8,
      pyr[i * 4 + next * 8].canvas.width * 4 - qw * 4,
    ];
    for (j = 0; j < cascade.stage_classifier.length; j += 1) {
      const origFeature = cascade.stage_classifier[j].feature;

      features[j] = new Array<ClassifierFeature>(
        cascade.stage_classifier[j].count
      );
      const feature = features[j];

      for (k = 0; k < cascade.stage_classifier[j].count; k += 1) {
        feature[k] = {
          size: origFeature[k].size,
          px: new Array(origFeature[k].size),
          pz: new Array(origFeature[k].size),
          nx: new Array(origFeature[k].size),
          nz: new Array(origFeature[k].size),
        };
        for (q = 0; q < origFeature[k].size; q += 1) {
          feature[k].px[q] =
            origFeature[k].px[q] * 4 +
            origFeature[k].py![q] * step[origFeature[k].pz[q]];
          feature[k].pz[q] = origFeature[k].pz[q];
          feature[k].nx[q] =
            origFeature[k].nx[q] * 4 +
            origFeature[k].ny![q] * step[origFeature[k].nz[q]];
          feature[k].nz[q] = origFeature[k].nz[q];
        }
      }
    }
    for (q = 0; q < 4; q += 1) {
      const u8 = [
        pyr[i * 4].data,
        pyr[i * 4 + next * 4].data,
        pyr[i * 4 + next * 8 + q].data,
      ];
      const u8o = [
        dx[q] * 8 + dy[q] * pyr[i * 4].canvas.width * 8,
        dx[q] * 4 + dy[q] * pyr[i * 4 + next * 4].canvas.width * 4,
        0,
      ];
      for (y = 0; y < qh; y += 1) {
        for (x = 0; x < qw; x += 1) {
          let sum = 0;
          let flag = true;
          for (j = 0; j < cascade.stage_classifier.length; j += 1) {
            sum = 0;
            const { alpha } = cascade.stage_classifier[j];
            const feature = features[j];
            for (
              k = 0;
              k < cascade.stage_classifier[j].count;
              k += 1
            ) {
              const featureK = feature[k];
              let p;
              let pmin =
                u8[featureK.pz[0]][
                  u8o[featureK.pz[0]] + featureK.px[0]
                ];
              let n;
              let nmax =
                u8[featureK.nz[0]][
                  u8o[featureK.nz[0]] + featureK.nx[0]
                ];
              if (pmin <= nmax) {
                sum += alpha[k * 2];
              } else {
                let f;
                let shortcut = true;
                for (f = 0; f < featureK.size; f += 1) {
                  if (featureK.pz[f] >= 0) {
                    p =
                      u8[featureK.pz[f]][
                        u8o[featureK.pz[f]] + featureK.px[f]
                      ];
                    if (p < pmin) {
                      if (p <= nmax) {
                        shortcut = false;
                        break;
                      }
                      pmin = p;
                    }
                  }
                  if (featureK.nz[f] >= 0) {
                    n =
                      u8[featureK.nz[f]][
                        u8o[featureK.nz[f]] + featureK.nx[f]
                      ];
                    if (n > nmax) {
                      if (pmin <= n) {
                        shortcut = false;
                        break;
                      }
                      nmax = n;
                    }
                  }
                }
                sum += shortcut ? alpha[k * 2 + 1] : alpha[k * 2];
              }
            }
            if (sum < cascade.stage_classifier[j].threshold) {
              flag = false;
              break;
            }
          }
          if (flag) {
            seq.push({
              x: (x * 4 + dx[q] * 2) * scaleX,
              y: (y * 4 + dy[q] * 2) * scaleY,
              width: cascade.width * scaleX,
              height: cascade.height * scaleY,
              neighbors: 1,
              confidence: sum,
            });
          }
          u8o[0] += 16;
          u8o[1] += 8;
          u8o[2] += 4;
        }
        u8o[0] += paddings[0];
        u8o[1] += paddings[1];
        u8o[2] += paddings[2];
      }
    }
    scaleX *= scale;
    scaleY *= scale;
  }

  if (!(minNeighbors > 0)) {
    return seq;
  }
  const result = arrayGroup(seq, (r1, r2) => {
    const distance = Math.floor(r1.width * 0.25 + 0.5);

    return (
      r2.x <= r1.x + distance &&
      r2.x >= r1.x - distance &&
      r2.y <= r1.y + distance &&
      r2.y >= r1.y - distance &&
      r2.width <= Math.floor(r1.width * 1.5 + 0.5) &&
      Math.floor(r2.width * 1.5 + 0.5) >= r1.width
    );
  });

  const ncomp = result.cat;
  const idxSeq = result.index;
  const comps = new Array(ncomp + 1);
  for (i = 0; i < comps.length; i += 1)
    comps[i] = {
      neighbors: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      confidence: 0,
    };

  // count number of neighbors
  for (i = 0; i < seq.length; i += 1) {
    const r1 = seq[i];
    const idx = idxSeq[i];

    if (comps[idx].neighbors === 0)
      comps[idx].confidence = r1.confidence;

    // ex ++comps[idx].neighbors;
    comps[idx].neighbors += 1;

    comps[idx].x += r1.x;
    comps[idx].y += r1.y;
    comps[idx].width += r1.width;
    comps[idx].height += r1.height;
    comps[idx].confidence = Math.max(
      comps[idx].confidence,
      r1.confidence
    );
  }

  const seq2: IPoint[] = [];
  // calculate average bounding box
  for (i = 0; i < ncomp; i += 1) {
    const n = comps[i].neighbors;
    if (n >= minNeighbors)
      seq2.push({
        x: (comps[i].x * 2 + n) / (2 * n),
        y: (comps[i].y * 2 + n) / (2 * n),
        width: (comps[i].width * 2 + n) / (2 * n),
        height: (comps[i].height * 2 + n) / (2 * n),
        neighbors: comps[i].neighbors,
        confidence: comps[i].confidence,
      });
  }

  const resultSeq: IPoint[] = [];
  // filter out small face rectangles inside large face rectangles
  for (i = 0; i < seq2.length; i += 1) {
    const r1 = seq2[i];
    let flag = true;
    for (j = 0; j < seq2.length; j += 1) {
      const r2 = seq2[j];
      const distance = Math.floor(r2.width * 0.25 + 0.5);

      if (
        i !== j &&
        r1.x >= r2.x - distance &&
        r1.y >= r2.y - distance &&
        r1.x + r1.width <= r2.x + r2.width + distance &&
        r1.y + r1.height <= r2.y + r2.height + distance &&
        (r2.neighbors > Math.max(3, r1.neighbors) || r1.neighbors < 3)
      ) {
        flag = false;
        break;
      }
    }

    if (flag) resultSeq.push(r1);
  }
  return resultSeq;
};
