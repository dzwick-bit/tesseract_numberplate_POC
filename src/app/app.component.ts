import {Component} from '@angular/core';
import {createWorker} from 'tesseract.js';
import {WebcamImage, WebcamInitError, WebcamUtil} from 'ngx-webcam';
import {Observable, Subject} from 'rxjs';
import Filter2D from './Filter2D';
import {compareNumbers} from '@angular/compiler-cli/src/diagnostics/typescript_version';
import findCorners from './HarrisCorner';
import {Rectangle, RectFit} from './RectFit';
import {RectFitV2} from './RectFitV2';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'tesseract.js-angular-app';
  ocrResult = 'Recognizing...';
  preprocessImage1: { url: string, text: string };
  preprocessImage2: { url: string, text: string };
  preprocessImage3: { url: string, text: string };
  preprocessImage4: { url: string, text: string };
  preprocessImage5: { url: string, text: string };
  ocrDone: boolean;
  // toggle webcam on/off
  public showWebcam = true;
  public allowCameraSwitch = true;
  public multipleWebcamsAvailable = false;
  public deviceId: string;
  public videoOptions: MediaTrackConstraints = {
    // width: {ideal: 1024},
    // height: {ideal: 576}
    aspectRatio: 1
  };
  public errors: WebcamInitError[] = [];

  // latest snapshot
  public webcamImage: WebcamImage = null;

  // webcam snapshot trigger
  private trigger: Subject<void> = new Subject<void>();
  // switch to next / previous / specific webcam; true/false: forward/backwards, string: deviceId
  private nextWebcam: Subject<boolean | string> = new Subject<boolean | string>();

  constructor() {
    WebcamUtil.getAvailableVideoInputs()
      .then((mediaDevices: MediaDeviceInfo[]) => {
        this.multipleWebcamsAvailable = mediaDevices && mediaDevices.length > 1;
        setInterval(() => {
          if (this.ocrDone) {
            this.triggerSnapshot()
          }
        }, 250);
      });
  }

  public triggerSnapshot(): void {
    this.trigger.next();
  }

  public toggleWebcam(): void {
    this.showWebcam = !this.showWebcam;
  }

  public handleInitError(error: WebcamInitError): void {
    this.errors.push(error);
  }

  public handleImage(webcamImage: WebcamImage): void {
    console.info('received webcam image', webcamImage);
    this.webcamImage = webcamImage;
    this.doOCR();
  }

  public cameraWasSwitched(deviceId: string): void {
    console.log('active device: ' + deviceId);
    this.deviceId = deviceId;
  }

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean | string> {
    return this.nextWebcam.asObservable();
  }

  async doOCR() {
    this.ocrDone = false;
    // TODO tesseract.js core should be bundled or we will load it from a third party

    //await this.preprocessDemo();

    //await this.detectRectDemo();
    await this.detectRectDemoV2();
    //await this.findPointsByFilter(this.webcamImage.imageData);

    this.ocrDone = true;
  }

  private async detectRectDemo() {
    this.ocrDone = false;
    const start = Date.now();
    const rects = await this.findRects(this.webcamImage.imageData);
    const candidates = await this.findNumberplates(this.webcamImage.imageData, rects);
    console.log('detectRectDemo execution time ' + (Date.now() - start) + 'ms');
    this.ocrDone = true;
  }

  private async detectRectDemoV2() {
    this.ocrDone = false;
    const start = Date.now();
    const rects = await this.findRectsV2(this.webcamImage.imageData);
    await this.findNumberplates(this.webcamImage.imageData, rects);
    console.log('detectRectDemo execution time ' + (Date.now() - start) + 'ms');
    this.ocrDone = true;
  }


  private async preprocessDemo() {
    const processedImages = await this.preprocessImageData(this.webcamImage.imageData);
    console.log(processedImages);
    this.preprocessImage1 = processedImages[0];
    this.preprocessImage2 = processedImages[1];
    this.preprocessImage3 = processedImages[2];
    this.preprocessImage4 = processedImages[3];
    this.preprocessImage5 = processedImages[4];
  }

  private async preprocessImageData(imageData: ImageData) {
    const w = imageData.width;
    const h = imageData.height;
    const worker = await createWorker('deu');
    const k1: number[] = [ //edge ltr
      1, 0, -1,
      2, 0, -2,
      1, 0, -1];
    const k6: number[] = [ //edge ttb
      1, 1, 1,
      0, 0, 0,
      -1, -1, -1];
    const k2: number[] = [//sharpen
      -1, -1, -1,
      -1, 8, -1,
      -1, -1, -1];
    const k3 = [//shapen
      0, -1, 0,
      -1, 4, -1,
      0, -1, 0
    ];
    const k4 = [//identity
      0, 0, 0,
      0, 1, 0,
      0, 0, 0
    ];
    const k5: number[] = [ //smooth
      1, 2, 1,
      2, 5, 2,
      1, 2, 1];
    const k7: number[] = [ //smooth
      1, 4, 7, 4, 1,
      4, 16, 26, 16, 4,
      7, 26, 41, 26, 7,
      4, 16, 26, 16, 4,
      1, 4, 7, 4, 1];
    const kernels = [k1, k2, k4, k4, k4];

    const results = await Promise.all(kernels.map(async (k) => {
      const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      let ctx = canvas.getContext('2d');
      const filtered = new Filter2D(copy, w, h);
      ctx.putImageData(filtered.applyKernel(k), 0, 0);
      let url = canvas.toDataURL();
      const data = await worker.recognize(url);
      console.log(data);

      //const corners = harrisCornerDetection(copy);
      //console.log(corners);

      const {data: {lines, text}} = data;
      const confidentLines = lines.filter((a) => a.confidence > 20);
      let ctx2 = canvas.getContext('2d');
      ctx2.beginPath();
      confidentLines.forEach(line => {
        const bbox = line.bbox;
        console.log(line.text, line.confidence, bbox);
        ctx2.rect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
      });
      ctx2.lineWidth = 3;
      ctx2.strokeStyle = 'green';
      ctx2.stroke();
      url = canvas.toDataURL();
      return {url, text};
    }));
    await worker.terminate();
    return results;
  }

  private async findRects(imageData: ImageData) {
    const candidates = [[]];
    const w = imageData.width;
    const h = imageData.height;
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

    const k1: number[] = [// laplacian
      0, -1, 0,
      -1, 4, -1,
      0, -1, 0];

    const k: number[] = [// laplacian
      0, 0, -1, 0, 0,
      0, -1, -2, -1, 0,
      -1, -2, 16, -2, -1,
      0, -1, -2, -1, 0,
      0, 0, -1, 0, 0];
    const filtered = new Filter2D(copy, w, h);

    const laplace = filtered.applyKernel(k);

    const hysteresis = filtered.applyTrackingHysteresis(60);
    await this.checkpoint(hysteresis, 1, 'hysteresis');

    const fitter = new RectFit();
    const {besthLines, bestvLines} = fitter.fitLinesByRotation(hysteresis, 30);
    console.log({besthLines, bestvLines});
    await this.drawLines(imageData, 2, 'lines', besthLines, bestvLines);

    const points = fitter.fitPointsByIntersection(besthLines, bestvLines, imageData.width, imageData.height);
    console.log(points);
    await this.drawPoints(imageData, 3, 'points', points);

    const rects = fitter.fitBestRectsFromPoints(points, imageData.data.length);
    console.log(rects);
    await this.drawRects(imageData, 4, 'rects', rects);

    return rects;
  }
  private async findRectsV2(imageData: ImageData) {
    const w = imageData.width;
    const h = imageData.height;
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

    const k1: number[] = [// laplacian
      0, -1, 0,
      -1, 4, -1,
      0, -1, 0];

    const k: number[] = [// laplacian
      0, 0, -1, 0, 0,
      0, -1, -2, -1, 0,
      -1, -2, 16, -2, -1,
      0, -1, -2, -1, 0,
      0, 0, -1, 0, 0];
    const filtered = new Filter2D(copy, w, h);

    const laplace = filtered.applyKernel(k);

    const hysteresis = filtered.applyTrackingHysteresis(30);
    const laplace2 = filtered.applyKernel(k1);
    const hysteresis2 = filtered.applyTrackingHysteresis(60);
    //await this.checkpoint(hysteresis, 1, 'hysteresis');

    const fitter = new RectFitV2();
    const {besthLines, bestvLines} = fitter.fitLinesByRotation(hysteresis, 20);
    //console.log({besthLines, bestvLines});
    //await this.drawLinesV2(imageData, 2, 'lines', besthLines, bestvLines);

    const points = fitter.fitPointsByIntersection(besthLines, bestvLines, imageData.width, imageData.height);
    //console.log(points);
    //await this.drawPoints(imageData, 3, 'points', points);

    const rects = fitter.fitBestRectsFromPoints(points, imageData.data.length);
    //console.log(rects);
    //await this.drawRects(imageData, 4, 'rects', rects);

    return rects;
  }

  private async findPointsByFilter(imageData: ImageData) {
    const w = imageData.width;
    const h = imageData.height;
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

    const k1: number[] = [ //edge ltr
      1, 0, -1,
      2, 0, -2,
      1, 0, -1];
    const k2: number[] = [ //edge ttb
      1, 1, 1,
      0, 0, 0,
      -1, -1, -1];
    const k3: number[] = [// laplacian
      0, -1, 0,
      -1, 4, -1,
      0, -1, 0];
    const filtered = new Filter2D(copy, w, h);

    const laplacian = filtered.applyKernel(k3);

    const hysteresis1 = filtered.applyTrackingHysteresis(30);
    await this.checkpoint(hysteresis1, 1, 'hysteresis');

    const copy2 = new ImageData(new Uint8ClampedArray(copy.data), imageData.width, imageData.height);
    const ltr = filtered.applyKernel(k1);
    await this.checkpoint(ltr, 2, 'ltr');

    const filtered2 = new Filter2D(copy2, w, h);

    const ttb = filtered2.applyKernel(k2);
    await this.checkpoint(ttb, 3, 'ttb');


    //const copy3 = new ImageData(new Uint8ClampedArray(copy.data.length), imageData.width, imageData.height);
    const points = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        /*copy3.data[i] = copy.data[i] * copy2.data[i]
        copy3.data[i+1] = copy.data[i+1] * copy2.data[i+1]
        copy3.data[i+2] = copy.data[i+2] * copy2.data[i+2]
        copy3.data[i+3] = copy.data[i+3] * copy2.data[i+3]*/
        if (copy.data[i] * copy2.data[i] > 128) {
          points.push({x, y, score: 1});
        }
      }
    }
    const fitter = new RectFit();
    const bestPoints = fitter.bestPoints(points);

    await this.drawPoints(imageData, 4, 'points', bestPoints);

    const rects = fitter.fitBestRectsFromPoints(bestPoints, imageData.data.length);
    console.log(rects);
    await this.drawRects(imageData, 5, 'rects', rects);


  }

  private async findNumberplates(imageData: ImageData, rects: Rectangle[]) {

    const w = imageData.width;
    const h = imageData.height;
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const filtered = new Filter2D(copy, w, h);
    const hysteresis = filtered.applyTrackingHysteresis(160);

    const extracts = rects.map(rect => this.extractImage(hysteresis, rect));
    const bestExtracts = extracts.map((img, index) => {
      return {img, score: (img.data.reduce((a, b) => a + b / (25 * img.data.length)) + rects[index].score)};
    }).sort((a, b) => b.score - a.score);
    console.log(bestExtracts.splice(0, 5));
    const worker = await createWorker('deu');
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.putImageData(bestExtracts[0].img, 0, 0);
    let url = canvas.toDataURL();
    const data = await worker.recognize(url);
    await this.checkpoint(bestExtracts[0].img, 5, 'best extract: ' + data.data.text);
    console.log(data.data);
    return bestExtracts;
  }

  private extractImage(imageData: ImageData, rect: Rectangle): ImageData {
    let x1 = rect.x1 < rect.x2 ? rect.x1 : rect.x2;
    let x2 = rect.x1 < rect.x2 ? rect.x2 : rect.x1;
    let y1 = rect.y1 < rect.y2 ? rect.y1 : rect.y2;
    let y2 = rect.y1 < rect.y2 ? rect.y2 : rect.y1;

    const w = x2 - x1;
    const h = y2 - y1;
    const newImageData = new Uint8ClampedArray(w * h * 4);
    for (let y = y1; y < y2; y++) {
      const startIdx = (y * imageData.width + x1) * 4;
      const endIdx = startIdx + w * 4;
      const subArr = imageData.data.subarray(startIdx, endIdx);
      newImageData.set(subArr, (y - y1) * w * 4);
    }
    return new ImageData(newImageData, w);
  }


  private async checkpoint(imageData: ImageData, position: number, name: string) {
    const w = imageData.width;
    const h = imageData.height;
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    let url = canvas.toDataURL();
    switch (position) {
      case 1:
        this.preprocessImage1 = {url, text: name};
        break;
      case 2:
        this.preprocessImage2 = {url, text: name};
        break;
      case 3:
        this.preprocessImage3 = {url, text: name};
        break;
      case 4:
        this.preprocessImage4 = {url, text: name};
        break;
      case 5:
        this.preprocessImage5 = {url, text: name};
        break;

    }
  }

  private async drawLines(imageData: ImageData, position: number, name: string,
                          besthLines: { y: number; theta: number; highscore: number }[],
                          bestvLines: { x: number; theta: number; highscore: number }[]
  ) {
    const w = imageData.width;
    const h = imageData.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    ctx.beginPath();
    besthLines.forEach(({y, theta}) => {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + w * Math.tan(theta));
    });
    bestvLines.forEach(({x, theta}) => {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * Math.tan(theta), h);
    });
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(255,0,221)';
    ctx.stroke();
    /*
        ctx.beginPath()
        const fitter = new RectFit()
        for (let y = 1; y < h - 1; y++) {
          const {x: _x, y: _y} = fitter.accessRotated(0.1, 50, y);
          ctx.moveTo(_x,_y)
          ctx.lineTo(_x+1,_y+1)
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(75,171,9)';
        ctx.stroke()*/

    let url = canvas.toDataURL();
    switch (position) {
      case 1:
        this.preprocessImage1 = {url, text: name};
        break;
      case 2:
        this.preprocessImage2 = {url, text: name};
        break;
      case 3:
        this.preprocessImage3 = {url, text: name};
        break;
      case 4:
        this.preprocessImage4 = {url, text: name};
        break;
      case 5:
        this.preprocessImage5 = {url, text: name};
        break;

    }
  }

  private async drawLinesV2(imageData: ImageData, position: number, name: string,
                          besthLines: {  x1: number, y1: number, x2: number, y2: number, highscore: number }[],
                          bestvLines: {  x1: number, y1: number, x2: number, y2: number, highscore: number }[]
  ) {
    const w = imageData.width;
    const h = imageData.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    ctx.beginPath();
    besthLines.forEach(({x1, x2,y1,y2}) => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    });
    bestvLines.forEach(({x1, x2,y1,y2}) => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    });
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(255,0,221)';
    ctx.stroke();
    let url = canvas.toDataURL();
    switch (position) {
      case 1:
        this.preprocessImage1 = {url, text: name};
        break;
      case 2:
        this.preprocessImage2 = {url, text: name};
        break;
      case 3:
        this.preprocessImage3 = {url, text: name};
        break;
      case 4:
        this.preprocessImage4 = {url, text: name};
        break;
      case 5:
        this.preprocessImage5 = {url, text: name};
        break;

    }
  }
  private async drawPoints(imageData: ImageData, position: number, name: string,
                           points: { x: number; y: number; }[]
  ) {
    const w = imageData.width;
    const h = imageData.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    ctx.beginPath();
    try{
    points.forEach(({x, y}) => {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1, y + 1);
    });
    } catch (e){}
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgb(218,173,4)';
    ctx.stroke();
    /*
        ctx.beginPath()
        const fitter = new RectFit()
        for (let y = 1; y < h - 1; y++) {
          const {x: _x, y: _y} = fitter.accessRotated(0.1, 50, y);
          ctx.moveTo(_x,_y)
          ctx.lineTo(_x+1,_y+1)
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(75,171,9)';
        ctx.stroke()*/

    let url = canvas.toDataURL();
    switch (position) {
      case 1:
        this.preprocessImage1 = {url, text: name};
        break;
      case 2:
        this.preprocessImage2 = {url, text: name};
        break;
      case 3:
        this.preprocessImage3 = {url, text: name};
        break;
      case 4:
        this.preprocessImage4 = {url, text: name};
        break;
      case 5:
        this.preprocessImage5 = {url, text: name};
        break;

    }
  }

  private async drawRects(imageData: ImageData, position: number, name: string,
                          rects: any[]
  ) {
    const w = imageData.width;
    const h = imageData.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    ctx.beginPath();
    rects.splice(5, 100).forEach(({x1, y1, x2, y2}) => {
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
    });
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(0,81,255)';
    ctx.stroke();
    ctx.beginPath();
    rects.splice(0, 10).forEach(({x1, y1, x2, y2}) => {
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
    });
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(255,128,0)';
    ctx.stroke();
    /*
        ctx.beginPath()
        const fitter = new RectFit()
        for (let y = 1; y < h - 1; y++) {
          const {x: _x, y: _y} = fitter.accessRotated(0.1, 50, y);
          ctx.moveTo(_x,_y)
          ctx.lineTo(_x+1,_y+1)
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(75,171,9)';
        ctx.stroke()*/

    let url = canvas.toDataURL();
    switch (position) {
      case 1:
        this.preprocessImage1 = {url, text: name};
        break;
      case 2:
        this.preprocessImage2 = {url, text: name};
        break;
      case 3:
        this.preprocessImage3 = {url, text: name};
        break;
      case 4:
        this.preprocessImage4 = {url, text: name};
        break;
      case 5:
        this.preprocessImage5 = {url, text: name};
        break;

    }
  }

}
