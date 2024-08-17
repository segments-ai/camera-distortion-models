import {
  WebGPURenderer,
  PostProcessing,
  Scene,
  Matrix3,
  Vector3,
  InstancedPointsNodeMaterial,
  Vector2,
  Vector4
} from "three";
import PinholeCamera from "./PinholeCamera";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader";

import { pass, renderOutput } from "three/tsl";

import InstancedPoints from 'three/addons/objects/InstancedPoints.js';
import InstancedPointsGeometry from 'three/addons/geometries/InstancedPointsGeometry.js';

// nodes
import calibration from "./calibration_brownconrady.json";
import { BrownConradyDistortion } from "./BrownConradyDistortionNode";


const { K, R, T, imageWidth, imageHeight, distortionCoefficients } =
  calibration;
// fromArray reads in column-major order
const matrixK = new Matrix3().fromArray(K).transpose();
const matrixR = new Matrix3().fromArray(R).transpose();
const vectorT = new Vector3().fromArray(T);

const zoomForDistortionFactor = 0.5

const scene = new Scene();
const camera = new PinholeCamera(
  matrixK,
  matrixR,
  vectorT,
  imageWidth,
  imageHeight,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
  1 / zoomForDistortionFactor
);

let distortionPass = null;
let relAspect = window.innerWidth / window.innerHeight / (imageWidth / imageHeight)

const loader = new PCDLoader();
loader.load(
  "/points.pcd",
  function (points: any) {

    const geometry = new InstancedPointsGeometry();
    geometry.setPositions(points.geometry.attributes.position.array);
    geometry.instanceCount = points.geometry.attributes.position.count;

    const material = new InstancedPointsNodeMaterial({

      color: 0x00ffff,
      pointWidth: 1, // in pixel units
      alphaToCoverage: false,

    });

    const instancedPoints = new InstancedPoints(geometry, material);

    scene.add(instancedPoints);
  },
  function (xhr: any) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  function (e: any) {
    console.error("Error when loading the point cloud", e);
  }
);

const renderer = new WebGPURenderer({
  antialias: false,
  forceWebGL: false
});

renderer.setPixelRatio(1 / zoomForDistortionFactor);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);


document.body.appendChild(renderer.domElement);

// post processing
const postProcessing = new PostProcessing(renderer);


postProcessing.outputColorTransform = false;


const scenePass = pass(scene, camera);
const outputPass = renderOutput(scenePass);



// brownCondary
const coefficients = new Vector4(
  distortionCoefficients.k1,
  distortionCoefficients.k2,
  distortionCoefficients.p1,
  distortionCoefficients.p2
)

const principalPoint = new Vector2(
  matrixK.elements[0 + 2 * 3],
  matrixK.elements[1 + 2 * 3]
);

const focalLength = new Vector2(
  matrixK.elements[0 + 0 * 3],
  matrixK.elements[1 + 1 * 3]
);

const imageDimensions = new Vector2(imageWidth, imageHeight);

distortionPass = BrownConradyDistortion(
  outputPass,
  coefficients,
  principalPoint,
  focalLength,
  imageDimensions,
  zoomForDistortionFactor,
  relAspect,
)

postProcessing.outputNode = distortionPass;

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  distortionPass.relAspect.value = window.innerWidth / window.innerHeight / (imageWidth / imageHeight)
})


async function animate() {
  postProcessing.renderAsync();
}

animate();
