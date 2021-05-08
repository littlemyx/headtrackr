import {
  Scene,
  Fog,
  PerspectiveCamera,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  CylinderGeometry,
  BufferGeometry,
  Vector3,
  Line,
  LineBasicMaterial,
  Float32BufferAttribute,
  WebGLRenderer,
} from "three";

import { realisticAbsoluteCameraControl } from "./Controllers";
import Tracker from "./Tracker";

function isCustomEvent(event: Event): event is CustomEvent {
  return "detail" in event;
}

const videoInput: HTMLVideoElement = document.getElementById(
  "vid"
) as HTMLVideoElement;
const canvasInput: HTMLCanvasElement = document.getElementById(
  "compare"
) as HTMLCanvasElement;

// 3d model setup

// let stats;
let camera: PerspectiveCamera;
let scene: Scene;
let renderer: WebGLRenderer;
// let plane;

// stats = new Stats();
// stats.domElement.style.position = "absolute";
// stats.domElement.style.top = "0px";
// document.body.appendChild(stats.domElement);

function animate() {
  renderer.render(scene, camera);
  // stats.update();

  requestAnimationFrame(animate);
}

const container: HTMLDivElement = document.createElement("div");
document.body.appendChild(container);

scene = new Scene();
scene.fog = new Fog(0x000000, 1, 5000);

camera = new PerspectiveCamera(
  23,
  window.innerWidth / window.innerHeight,
  1,
  100000
);
camera.position.z = 6000;
scene.add(camera);

// Planes

// top wall
const plane1 = new Mesh(
  new PlaneGeometry(500, 3000, 5, 15),
  new MeshBasicMaterial({ color: 0xcccccc, wireframe: true })
);
plane1.rotation.x = Math.PI / 2;
plane1.position.y = 250;
plane1.position.z = 50 - 1500;
scene.add(plane1);

// left wall
const plane2 = new Mesh(
  new PlaneGeometry(3000, 500, 15, 5),
  new MeshBasicMaterial({ color: 0xcccccc, wireframe: true })
);
plane2.rotation.y = Math.PI / 2;
plane2.position.x = -250;
plane2.position.z = 50 - 1500;
scene.add(plane2);

// right wall
const plane3 = new Mesh(
  new PlaneGeometry(3000, 500, 15, 5),
  new MeshBasicMaterial({ color: 0xcccccc, wireframe: true })
);
plane3.rotation.y = -Math.PI / 2;
plane3.position.x = 250;
plane3.position.z = 50 - 1500;
scene.add(plane3);

// bottom wall
const plane4 = new Mesh(
  new PlaneGeometry(500, 3000, 5, 15),
  new MeshBasicMaterial({ color: 0xcccccc, wireframe: true })
);
plane4.rotation.x = -Math.PI / 2;
plane4.position.y = -250;
plane4.position.z = 50 - 1500;
scene.add(plane4);

// Create sprites with lines

const placeTarget = (x: number, y: number, z: number): void => {
  // Cylinder
  const cylinder = new Mesh(
    new CylinderGeometry(30, 30, 1, 20, 1, false),
    new MeshBasicMaterial({ color: 0xeeeeee })
  );
  cylinder.position.x = x;
  cylinder.rotation.x = Math.PI / 2;
  cylinder.position.y = y;
  cylinder.position.z = z;
  scene.add(cylinder);

  const geometry = new BufferGeometry();
  const vertices = [];
  vertices.push(0, 0, -80000);
  vertices.push(0, 0, z);
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(vertices, 3)
  );
  const line = new Line(
    geometry,
    new LineBasicMaterial({ color: 0xeeeeee })
  );
  line.position.x = x;
  line.position.y = y;
  scene.add(line);
};

placeTarget(-150, -150, -550);
placeTarget(0, -150, -200);
placeTarget(100, 0, 500);
placeTarget(-150, 100, 0);
placeTarget(150, -100, -1050);
placeTarget(50, 0, 1100);
placeTarget(-50, -50, 600);
placeTarget(0, 150, -2100);
placeTarget(-130, 0, -700);

renderer = new WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

container.appendChild(renderer.domElement);

animate();

// video styling
videoInput.style.position = "absolute";
videoInput.style.top = "50px";
videoInput.style.zIndex = "100001";
videoInput.style.display = "block";

// set up camera controller
realisticAbsoluteCameraControl(
  camera,
  27,
  [0, 0, 50],
  new Vector3(0, 0, 0),
  { damping: 0.5 }
);

// Face detection setup
const htracker = new Tracker(
  {
    altVideo: {
      ogv: "./media/capture5.ogv",
      mp4: "./media/capture5.mp4",
    },
  },
  {
    video: videoInput,
    canvas: canvasInput,
  }
);
htracker.start();

document.addEventListener(
  "headtrackingEvent",
  (event: Event) => {
    if (!isCustomEvent(event)) {
      throw new Error("not a custom event");
    }
    const {
      detail: { z },
    } = event;
    scene.fog = new Fog(0x000000, 1 + z * 27, 3000 + z * 27);
  },
  false
);
