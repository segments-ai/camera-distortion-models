import {
  WebGLRenderer,
  Scene,
  Matrix3,
  Vector3,
  PointsMaterial,
  Color,
} from "three";
import calibration from "./calibration.json";
import PinholeCamera from "./PinholeCamera";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader";

const { K, R, T, imageWidth, imageHeight } = calibration;
// fromArray reads in column-major order
const matrixK = new Matrix3().fromArray(K).transpose();
const matrixR = new Matrix3().fromArray(R).transpose();
const vectorT = new Vector3().fromArray(T);

const scene = new Scene();
const camera = new PinholeCamera(
  matrixK,
  matrixR,
  vectorT,
  imageWidth,
  imageHeight,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
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

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
