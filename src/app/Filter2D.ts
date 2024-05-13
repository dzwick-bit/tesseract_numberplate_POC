class Filter2D {

  width: number;
  height: number;
  imgData: ImageData;

  constructor(imageData: ImageData, width: number, height: number) {

    this.width = width;
    this.height = height;
    this.imgData = imageData;
  }

  applyTrackingHysteresis(threshhold: number = 50): ImageData {
    const pixels = this.imgData.data;
    const width: number = this.imgData.width;
    const height: number = this.imgData.height;

    //ignore image borders
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        let value = 0;
        if (pixels[i] > threshhold && (
          // only x/y yields good enough results
          //pixels[i - 1 - width] > threshhold ||
          pixels[i - width] > threshhold ||
          //pixels[i + 1 - width] > threshhold ||
          pixels[i - 1] > threshhold ||
          pixels[i + 1] > threshhold ||
          //pixels[i - 1 + width] > threshhold ||
          pixels[i + width] > threshhold //||
          //pixels[i + 1 + width] > threshhold
        )) {
          value = 255;
        }

        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;
      }
    }

    return this.imgData;
  }

  inverse(): ImageData {
    const pixels = this.imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255 - pixels[i]; // red pixels[i + 1] = 255 - pixels[i + 1]; // green pixels[i + 2] = 255 - pixels[i + 2]; // blue
    }
    return this.imgData;
  }

  applyKernel(kernel: any[]): ImageData {
    const dim = Math.sqrt(kernel.length);
    const pad = Math.floor(dim / 2);
    let weight: number = kernel.reduce((previousValue, currentValue) => previousValue + currentValue);
    if (weight === 0) {
      weight = 1;
    }

    const pixels: Uint8ClampedArray = this.imgData.data;
    const width: number = this.imgData.width;
    const height: number = this.imgData.height;

    // Create a copy of the original pixels
    const originalPixels = new Uint8ClampedArray(pixels);

    // Iterate over each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {

        // Initialize the new color values to 0
        let r = 0, g = 0, b = 0;

        // Apply the convolution kernel to the neighborhood
        for (let ky = -pad; ky <= pad; ky++) {
          for (let kx = -pad; kx <= pad; kx++) {
            // Calculate the corresponding index in the kernel
            const ki = (ky + pad) * dim + (kx + pad);

            // Calculate the corresponding index in the image
            const xi = Math.min(width - 1, Math.max(0, x + kx));
            const yi = Math.min(height - 1, Math.max(0, y + ky));
            const ii = (yi * width + xi) * 4;

            // Update the new color values
            r += originalPixels[ii] * kernel[ki];
            g += originalPixels[ii + 1] * kernel[ki];
            b += originalPixels[ii + 2] * kernel[ki];
          }
        }

        // Write the new color values to the image data
        const i = (y * width + x) * 4;
        pixels[i] = r / weight;
        pixels[i + 1] = g / weight;
        pixels[i + 2] = b / weight;
      }
    }

    return this.imgData;
  }
}

export default Filter2D;
