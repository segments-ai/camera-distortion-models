import {
  WebGLRenderer,
  Scene,
  Matrix3,
  Vector3,
  PointsMaterial,
  Color,
  Vector2,
} from "three";
import calibration from "./calibration.json";
import PinholeCamera from "./PinholeCamera";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { BrownConradyDistortionShader } from "./BrownConradyDistortion";

const { K, R, T, imageWidth, imageHeight, distortionCoefficients } =
  calibration;
// fromArray reads in column-major order
const matrixK = new Matrix3().fromArray(K).transpose();
const matrixR = new Matrix3().fromArray(R).transpose();
const vectorT = new Vector3().fromArray(T);

const zoomForDistortionFactor = 0.5;


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

const loader = new PCDLoader();
loader.load(
  "https://segmentsai-prod.s3.eu-west-2.amazonaws.com/assets/admin-tobias/41089c53-efca-4634-a92a-0c4143092374.pcd",
  function (points) {
    (points.material as PointsMaterial).size = 2;
    (points.material as PointsMaterial).color = new Color(0x00ffff);
    scene.add(points);
  },
  function (xhr) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  function (e) {
    console.error("Error when loading the point cloud", e);
  }
);

const renderer = new WebGLRenderer({
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1 / zoomForDistortionFactor);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const distortionPass = new ShaderPass(BrownConradyDistortionShader);
distortionPass.uniforms.uCoefficients.value = [
  distortionCoefficients.k1,
  distortionCoefficients.k2,
  distortionCoefficients.p1,
  distortionCoefficients.p2,
  distortionCoefficients.k3,
];
distortionPass.uniforms.uPrincipalPoint.value = new Vector2(
  matrixK.elements[0 + 2 * 3],
  matrixK.elements[1 + 2 * 3]
);
distortionPass.uniforms.uFocalLength.value = new Vector2(
  matrixK.elements[0 + 0 * 3],
  matrixK.elements[1 + 1 * 3]
);
distortionPass.uniforms.uImageWidth.value = imageWidth;
distortionPass.uniforms.uImageHeight.value = imageHeight;
distortionPass.uniforms.uZoomForDistortionFactor.value =
  zoomForDistortionFactor;
distortionPass.uniforms.uRelAspect.value =
  window.innerWidth / window.innerHeight / (imageWidth / imageHeight);
composer.addPass(distortionPass);

function animate() {
  requestAnimationFrame(animate);
  composer.render();
}

animate();
