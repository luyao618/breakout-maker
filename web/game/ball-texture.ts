import * as THREE from "three";

export function createBallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f6f4eb";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#d7793e";
  ctx.fillRect(0, 54, 256, 20);
  ctx.fillStyle = "#283a40";
  ctx.fillRect(0, 52, 256, 2);
  ctx.fillRect(0, 74, 256, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
