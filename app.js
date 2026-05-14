const camera = document.querySelector('#camera');
const snapshot = document.querySelector('#snapshot');
const result = document.querySelector('#result');
const startCameraButton = document.querySelector('#startCamera');
const captureButton = document.querySelector('#capturePhoto');
const applyButton = document.querySelector('#applyCutout');
const downloadButton = document.querySelector('#downloadPhoto');
const printButton = document.querySelector('#printPhoto');
const photoUpload = document.querySelector('#photoUpload');
const backgroundUpload = document.querySelector('#backgroundUpload');
const resetBackgroundButton = document.querySelector('#resetBackground');
const keyColorInput = document.querySelector('#keyColor');
const backgroundColorInput = document.querySelector('#backgroundColor');
const toleranceInput = document.querySelector('#tolerance');
const softnessInput = document.querySelector('#softness');
const toleranceValue = document.querySelector('#toleranceValue');
const softnessValue = document.querySelector('#softnessValue');
const photoSizeInput = document.querySelector('#photoSize');
const emptyState = document.querySelector('#emptyState');
const cameraStatus = document.querySelector('#cameraStatus');

const sizes = {
  passport: { width: 413, height: 579, label: '2寸证件照' },
  oneInch: { width: 295, height: 413, label: '1寸证件照' },
  square: { width: 1000, height: 1000, label: '方形头像' },
  postcard: { width: 1181, height: 1748, label: '明信片' },
};

let sourceImage = null;
let backgroundImage = null;
let cameraStream = null;
let rendered = false;

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function colorDistance(pixel, keyColor) {
  const red = pixel[0] - keyColor.r;
  const green = pixel[1] - keyColor.g;
  const blue = pixel[2] - keyColor.b;
  return Math.sqrt(red * red + green * green + blue * blue);
}

function drawImageCover(context, image, width, height) {
  const ratio = Math.max(width / image.width, height / image.height);
  const scaledWidth = image.width * ratio;
  const scaledHeight = image.height * ratio;
  const x = (width - scaledWidth) / 2;
  const y = (height - scaledHeight) / 2;
  context.drawImage(image, x, y, scaledWidth, scaledHeight);
}

function setCameraReady(isReady, message) {
  const dot = cameraStatus.querySelector('.dot');
  dot.classList.toggle('ready', isReady);
  cameraStatus.lastChild.textContent = ` ${message}`;
}

function setSourceFromCanvas(canvas) {
  const image = new Image();
  image.onload = () => {
    sourceImage = image;
    applyCutout();
  };
  image.src = canvas.toDataURL('image/png');
}

function loadFileAsImage(file, onLoad) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => onLoad(image);
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' },
      audio: false,
    });
    camera.srcObject = cameraStream;
    setCameraReady(true, '摄像头已启动');
  } catch (error) {
    setCameraReady(false, '摄像头启动失败');
    alert(`无法启动摄像头：${error.message}`);
  }
}

function capturePhoto() {
  if (!cameraStream) {
    alert('请先启动摄像头，或直接导入一张照片。');
    return;
  }

  snapshot.width = camera.videoWidth || 1280;
  snapshot.height = camera.videoHeight || 960;
  const context = snapshot.getContext('2d');
  context.drawImage(camera, 0, 0, snapshot.width, snapshot.height);
  setSourceFromCanvas(snapshot);
}

function drawBackground(context, width, height) {
  context.fillStyle = backgroundColorInput.value;
  context.fillRect(0, 0, width, height);

  if (backgroundImage) {
    drawImageCover(context, backgroundImage, width, height);
  }
}

function makeCutoutLayer(width, height) {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const context = layer.getContext('2d', { willReadFrequently: true });
  drawImageCover(context, sourceImage, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const keyColor = hexToRgb(keyColorInput.value);
  const tolerance = Number(toleranceInput.value);
  const softness = Number(softnessInput.value);

  for (let index = 0; index < data.length; index += 4) {
    const distance = colorDistance(data.subarray(index, index + 3), keyColor);
    if (distance <= tolerance) {
      data[index + 3] = 0;
    } else if (softness > 0 && distance <= tolerance + softness) {
      const fade = (distance - tolerance) / softness;
      data[index + 3] = Math.round(data[index + 3] * fade);
    }
  }

  context.putImageData(imageData, 0, 0);
  return layer;
}

function applyCutout() {
  if (!sourceImage) {
    alert('请先拍照或导入照片。');
    return;
  }

  const size = sizes[photoSizeInput.value];
  result.width = size.width;
  result.height = size.height;
  result.setAttribute('aria-label', `${size.label}处理结果`);

  const context = result.getContext('2d');
  drawBackground(context, result.width, result.height);
  const cutoutLayer = makeCutoutLayer(result.width, result.height);
  context.drawImage(cutoutLayer, 0, 0);

  rendered = true;
  emptyState.hidden = true;
}

function downloadPhoto() {
  if (!rendered) {
    alert('请先生成照片。');
    return;
  }

  const link = document.createElement('a');
  link.download = `cutout-photo-${Date.now()}.png`;
  link.href = result.toDataURL('image/png');
  link.click();
}

function printPhoto() {
  if (!rendered) {
    alert('请先生成照片。');
    return;
  }

  window.print();
}

startCameraButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', capturePhoto);
applyButton.addEventListener('click', applyCutout);
downloadButton.addEventListener('click', downloadPhoto);
printButton.addEventListener('click', printPhoto);
resetBackgroundButton.addEventListener('click', () => {
  backgroundImage = null;
  if (sourceImage) applyCutout();
});

toleranceInput.addEventListener('input', () => {
  toleranceValue.textContent = toleranceInput.value;
});

softnessInput.addEventListener('input', () => {
  softnessValue.textContent = softnessInput.value;
});

photoUpload.addEventListener('change', (event) => {
  loadFileAsImage(event.target.files[0], (image) => {
    sourceImage = image;
    applyCutout();
  });
});

backgroundUpload.addEventListener('change', (event) => {
  loadFileAsImage(event.target.files[0], (image) => {
    backgroundImage = image;
    if (sourceImage) applyCutout();
  });
});

backgroundColorInput.addEventListener('input', () => {
  backgroundImage = null;
  if (sourceImage) applyCutout();
});

photoSizeInput.addEventListener('change', () => {
  if (sourceImage) applyCutout();
});

document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    backgroundColorInput.value = button.dataset.bg;
    backgroundImage = null;
    if (sourceImage) applyCutout();
  });
});
