
type Point = { x: number, y: number };

export default function harrisCornerDetection(imageData: ImageData): Point[] {
  const width = imageData.width;
  const height = imageData.height;
  const corners: Point[] = [];

  // Parameters for the algorithm
  const windowSize = 5;
  const k = 0.001;
  const threshold = 100_000_000;

  // Convert ImageData to grayscale
  const grayImage = new Uint8Array(width * height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    grayImage[i / 4] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
  }

  // Compute gradients
  const Ix = new Float32Array(width * height);
  const Iy = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      Ix[i] = (grayImage[i - 1] - grayImage[i + 1]) / 2;
      Iy[i] = (grayImage[i - width] - grayImage[i + width]) / 2;
    }
  }

  // Compute corner response
  const R = new Float32Array(width * height);
  for (let y = windowSize; y < height - windowSize; y++) {
    for (let x = windowSize; x < width - windowSize; x++) {
      let sumIx2 = 0, sumIy2 = 0, sumIxIy = 0;
      for (let wy = -windowSize; wy <= windowSize; wy++) {
        for (let wx = -windowSize; wx <= windowSize; wx++) {
          const i = (y + wy) * width + (x + wx);
          sumIx2 += Ix[i] * Ix[i];
          sumIy2 += Iy[i] * Iy[i];
          sumIxIy += Ix[i] * Iy[i];
        }
      }
      const det = sumIx2 * sumIy2 - sumIxIy * sumIxIy;
      const trace = sumIx2 + sumIy2;
      R[y * width + x] = det - k * trace * trace;
    }
  }

  // Extract corners
  for (let y = windowSize; y < height - windowSize; y++) {
    for (let x = windowSize; x < width - windowSize; x++) {
      if (R[y * width + x] > threshold) {
        corners.push({ x, y });
      }
    }
  }

  return corners;
}

