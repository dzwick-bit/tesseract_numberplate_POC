// TODO replace with Flyweight
class Vector {
  x: number;
  y: number;
  dx: number;
  dy: number;

  constructor(x: number, y: number, dx: number, dy: number) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
  }
}


export class RectFitV2 {

  nearLimit = 15;

  ROTATION_VALUES = [-0.2, -0.15, -0.1, -.069,-0.052,-0.034, 0, 0.034,0.052, 0.069, 0.1, 0.15, 0.2]; //, 81, 82, 83, 84, 85, 86, 87, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99];

  sin = new Array<number>(this.ROTATION_VALUES.length);
  cos = new Array<number>(this.ROTATION_VALUES.length);

  constructor() {
    //for (let theta = 0; theta <= 180; theta += this.ROTATION_INCREMENT) {
    this.ROTATION_VALUES.forEach(theta => {
      this.sin[theta] = Math.sin(theta);
      this.cos[theta] = Math.cos(theta);
    });
  }

  public accessRotated(theta: number, x: number, y: number) {
    const _x = Math.floor((x * this.cos[theta] - y * this.sin[theta]));
    const _y = Math.floor((y * this.cos[theta] + x * this.sin[theta]));
    return {x: _x, y: _y};
  }

  fitLinesByRotation(imageData: ImageData, threshhold: number = 50) {
    let hlines = new Array<{ x1: number, x2: number, y1: number, y2: number, highscore: number}>();
    let vlines = new Array<{ x1: number, x2: number, y1: number, y2: number, highscore: number}>();

    const binary = this.asBinarised(imageData);
    const width = imageData.width
    const height = imageData.height

    //for (let theta = 0; theta <= 180 - this.ROTATION_INCREMENT; theta += this.ROTATION_INCREMENT) {
    this.ROTATION_VALUES.forEach(theta => {
      for (let y = 1; y < height - 1; y++) {
        let sum = 0;
        let sumR = 0;
        let startY = 0;
        let startYR = 0;
        let startX = 0;
        let startXR = 0;
        let inLine = false;
        let inLineR = false;
        let highscore = 0;
        let highscoreR = 0;

        for (let x = 1; x < width - 1; x++) {
          const {x: _x, y: _y} = this.accessRotated(theta, x, y);

          if(_x<0 || _y<0 || _x > width ||_y > height){
            continue
          }

          const i = (_y * width + _x);
          sum += binary[i] > 1 ? 1 : -1;
          if (sum < 0) {
            sum = 0;
            startX = _x;
            startY = _y;
          }
          if (sum > threshhold) {
            inLine = true;
            sum = threshhold;
            binary[i] = 0
            highscore++;
          }
          if (inLine && (sum <= 0 || x === width)) {
            hlines.push({x1: startX, x2: _x, y1: startY, y2: _y, highscore: highscore+threshhold});
            startX = _x;
            startY = _y;
            sum=0;
            inLine = false;
            highscore=0;
          }

          //use same loop but iterate 90 deg rotated
          const iR = (_x * width + _y);
          sumR += binary[iR] > 1 ? 1 : -1;
          if (sumR < 0) {
            sumR = 0;
            startXR = _x;
            startYR = _y;
          }
          if (sumR > threshhold) {
            inLineR = true;
            sumR = threshhold
            binary[iR] = 0
            highscoreR++
          }
          if (inLineR && (sumR <= 0 || x === width)) {
            vlines.push({x1: startYR, x2: _y, y1: startXR, y2: _x, highscore: highscoreR+threshhold});
            startXR = _x;
            startYR = _y;
            sumR=0;
            inLineR = false;
            highscoreR=0;
          }
        }
      }
    });

    //cleanup lines
    vlines=vlines.sort((a, b)=>b.x1-a.x1).reverse()

    let bestvLines = new Array<{ x1: number, x2: number, y1: number, y2: number, highscore: number}>();
    let besthLines = new Array<{ x1: number, x2: number, y1: number, y2: number, highscore: number}>();
    let best = hlines[0];
    hlines.forEach((value) => {
      if (isNear(value.y1, best.y1, this.nearLimit) && isNear(value.y2, best.y2, this.nearLimit)) {
        if (value.highscore > best.highscore) {
          best = value;
        }
      } else {
        besthLines.push(best);
        best = value;
      }
    });
    let bestv = vlines[0];
    vlines.forEach((value) => {
      if ((isNear(value.x1, bestv.x1, this.nearLimit)) && isNear(value.x2, bestv.x2, this.nearLimit)) {
        if (value.highscore > bestv.highscore) {
          bestv = value;
        }
      } else {
        bestvLines.push(bestv);
        bestv = value;
      }
    });

    return {besthLines, bestvLines};
    //return {besthLines:hlines, bestvLines:vlines};
  }


  private asBinarised(imageData: ImageData) {
    return imageData.data.filter((_, index) => index % 4 === 0)//.map((value) => value >= 1 ? 1 : 0);
  }

  fitPointsByIntersection(
    besthLines: { x1: number, x2: number, y1: number, y2: number, highscore: number}[],
    bestvLines: { x1: number, x2: number, y1: number, y2: number, highscore: number}[],
    width: number, heigt: number) {
    const TOLERANCE = 40; // pixel tolerance for near intersections
    let points = [];

    for (let hLine of besthLines) {
      for (let vLine of bestvLines) {
        if (vLine.x1 >= hLine.x1 - TOLERANCE && vLine.x1 <= hLine.x2 + TOLERANCE) {
          if (hLine.y1 >= vLine.y1 - TOLERANCE && hLine.y1 <= vLine.y2 + TOLERANCE) {
            points.push({ x: vLine.x1, y: hLine.y1, score: hLine.highscore + vLine.highscore});
          }
        }
      }
    }

    const outlineignore = 40;
    points = points.filter(value => value.x > outlineignore
      && value.y > outlineignore
      && value.x < width - outlineignore
      && value.y < heigt - outlineignore);
    const bestPoints = this.bestPoints(points);
    return bestPoints;
  }

  bestPoints(points: { x: number; y: number; score: number }[]) {
    const bestPoints = [points[0]];
    for (const point of points) {
      let consumed = false;
      for (const [index, best] of bestPoints.entries()) {
        if (isNear(point.x, best.x, 10) && isNear(point.y, best.y, 10)) {
          if (point.score > best.score) {
            bestPoints[index] = point;
          }
          consumed = true;
          break;
        }
      }
      if (!consumed) {
        bestPoints.push(point);
      }
    }
    return bestPoints;
  }

  fitBestRectsFromPoints(points: { x: number; y: number; score: number }[], length: number) {

    const targetAspect = [5.5, 4.5, 2.5];

    const rects = new Array<{ x1: number, y1: number, x2: number, y2: number, score: number, aspectScore:number, areaScore:number, pointScore:number }>();

    for (const p1 of points) {
      for (const p2 of points) {
        const aspect = Math.abs( (p1.x - p2.x) / (p1.y - p2.y));
        const aspectScore = targetAspect.map(target => {
          if (isNear(aspect, target, 0.2)) {
            return 10;
          } else if (isNear(aspect, target, 0.5)) {
            return 3;
          } else {
            return 1;
          }
        }).sort((a, b) => b-a);
        const areaScore = (p1.x - p2.x) * (p1.y - p2.y) > length / 100 ? 10 : 1;
        const pointScore = p1.score + p2.score;
        rects.push({x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, score: Math.abs(aspectScore[0] * areaScore * pointScore), aspectScore:aspectScore[0],areaScore,pointScore});
      }
    }
    return removeOverlappingRectangles(rects.sort((a,b)=>b.score-a.score).splice(0,500))
  }
}
export type Rectangle = { x1: number, y1: number, x2: number, y2: number, score: number };

function calculateOverlap(rect1: Rectangle, rect2: Rectangle): number {
  const x_overlap = Math.max(0, Math.min(rect1.x2, rect2.x2) - Math.max(rect1.x1, rect2.x1));
  const y_overlap = Math.max(0, Math.min(rect1.y2, rect2.y2) - Math.max(rect1.y1, rect2.y1));
  const overlapArea = x_overlap * y_overlap;
  const rect1Area = (rect1.x2 - rect1.x1) * (rect1.y2 - rect1.y1);
  const rect2Area = (rect2.x2 - rect2.x1) * (rect2.y2 - rect2.y1);
  const totalArea = rect1Area + rect2Area - overlapArea;
  return overlapArea / totalArea;
}

function removeOverlappingRectangles(rectangles: Rectangle[]): Rectangle[] {
  rectangles.sort((a, b) => b.score - a.score);
  const result: Rectangle[] = [];
  for (let i = 0; i < rectangles.length; i++) {
    let overlap = false;
    for (let j = 0; j < result.length; j++) {
      if (calculateOverlap(rectangles[i], result[j]) > 0.8) {
        overlap = true;
        break;
      }
    }
    if (!overlap) {
      result.push(rectangles[i]);
    }
  }
  return result;
}


function isNear(first: number, second: number, limit: number) {
  return Math.abs(first - second) < limit;
}

function padMatrixSquare(flattenedMatrix: Uint8ClampedArray, width: number, padding: number) {
  const height = flattenedMatrix.length / width;
  let yPadding = padding;
  let xPadding = padding;
  const paddedWidth = width + 2 * padding;
  const paddedHeight = height + 2 * padding;
  let paddedMatrix = new Uint8Array(paddedWidth * paddedHeight).fill(0);

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const originalIndex = i * width + j;
      const paddedIndex = (i + yPadding) * paddedWidth + (j + xPadding);
      paddedMatrix[paddedIndex] = flattenedMatrix[originalIndex];
    }
  }

  return {paddedMatrix, paddedWidth, paddedHeight};
}
