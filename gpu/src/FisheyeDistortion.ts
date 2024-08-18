import {
  DataTexture,
  RGBAFormat,
  FloatType,
  NearestFilter,
  LinearFilter,
  Matrix3,
} from "three";


import { uv, texture, passTexture, uniform, max, QuadMesh, RenderTarget, Vector2, nodeObject, addNodeElement, NodeUpdateType, float, vec4, TempNode, If, add, sub, div, vec2, tslFn } from 'three/tsl'

const _size = /*@__PURE__*/ new Vector2();
const _quadMesh = /*@__PURE__*/ new QuadMesh();

class FisheyeDistortionNode extends TempNode {

  constructor(textureNode, distortionLUT, relAspect = 1.0) {

    super(textureNode);

    this.textureNode = textureNode;
    this.distortionLUT = texture(distortionLUT);
    this.relAspect = uniform(relAspect);

    this._rtt = new RenderTarget();
    this._rtt.texture.name = 'FisheyeDistortionNode.comp';

    this._textureNode = passTexture(this, this._rtt.texture);

    this.updateBeforeType = NodeUpdateType.RENDER;

  }

  getTextureNode() {

    return this._textureNode;

  }

  setSize(width, height) {

    this._rtt.setSize(width, height);

  }

  updateBefore(frame) {

    const { renderer } = frame;

    renderer.getDrawingBufferSize(_size);

    this.setSize(_size.x, _size.y);

    const currentRenderTarget = renderer.getRenderTarget();

    renderer.setRenderTarget(this._rtt);
    _quadMesh.render(renderer);

    renderer.setRenderTarget(currentRenderTarget);

  }

  setup(builder) {

    const textureNode = this.textureNode;

    //

    const uvNode = textureNode.uvNode || uv();

    const { distortionLUT, relAspect } = this;

    const sampleDiffuse = (uv) => textureNode.uv(uv)
    const sampleDistortionLUT = (uv) => distortionLUT.uv(uv)

    const fisheyeDistortion = tslFn(() => {

      const relAspectFactorX = float(max(1.0, relAspect)).toVar();
      const relAspectFactorY = float(max(1.0, div(1.0, relAspect))).toVar();
      const relAspectOffsetX = float(sub(1.0, relAspectFactorX).div(2.0)).toVar();
      const relAspectOffsetY = float(sub(1.0, relAspectFactorY).div(2.0)).toVar();
      const inputCoordinatesWithAspectOffset = vec2(uvNode.x.mul(relAspectFactorX).add(relAspectOffsetX), uvNode.y.mul(relAspectFactorY).add(relAspectOffsetY)).toVar();
      const threshold = float(0.001).toVar();
      const outputCoordinates = vec2(sampleDistortionLUT(inputCoordinatesWithAspectOffset)).toVar();

      const output = vec4(0).toVar();

      If(inputCoordinatesWithAspectOffset.x.lessThanEqual(add(0.0, threshold)).or(inputCoordinatesWithAspectOffset.x.greaterThanEqual(sub(1.0, threshold))).or(inputCoordinatesWithAspectOffset.y.lessThanEqual(add(0.0, threshold))).or(inputCoordinatesWithAspectOffset.y.greaterThanEqual(sub(1.0, threshold))), () => {

        output.assign(vec4(0.0, 0.0, 0.0, 0.4));

      }).elseif(outputCoordinates.x.equal(0.0).and(outputCoordinates.y.equal(0.0)), () => {

        output.assign(vec4(0.0, 0.0, 0.0, 0.4));

      }).else(() => {

        const coordinatesWithAspectOffset = vec2(outputCoordinates.x.sub(relAspectOffsetX).div(relAspectFactorX), outputCoordinates.y.sub(relAspectOffsetY).div(relAspectFactorY)).toVar();
        output.assign(sampleDiffuse(coordinatesWithAspectOffset));

      });

      return output;

    });

    //

    const materialComposed = this._materialComposed || (this._materialComposed = builder.createNodeMaterial());
    materialComposed.fragmentNode = fisheyeDistortion();

    _quadMesh.material = materialComposed;

    //

    const properties = builder.getNodeProperties(this);
    properties.textureNode = textureNode;

    //

    return this._textureNode;

  }

  dispose() {

    this._rtt.dispose();

  }

}

export const FisheyeDistortion = (node, distortionLUT, relAspect) => nodeObject(new FisheyeDistortionNode(nodeObject(node).toTexture(), distortionLUT, relAspect));

addNodeElement('fisheyeDistortion', FisheyeDistortion);

export default FisheyeDistortionNode;



export interface FisheyeCoefficients {
  k1: number;
  k2: number;
  k3: number;
  k4: number;
}

export function computeFisheyeLUT(
  intrinsicMatrix: Matrix3,
  coefficients: FisheyeCoefficients,
  imageWidth: number,
  imageHeight: number,
  zoomForDistortionFactor: number
) {
  const resolutionOfLUT = 512;
  const rgbaDistortionLUT = Array.from(
    { length: resolutionOfLUT * resolutionOfLUT * 4 },
    () => 0
  );

  const newIntrinsicMatrixInverse =
    computeIntrinsicMatrixInverseWithZoomForDistortion(
      intrinsicMatrix,
      zoomForDistortionFactor,
      imageWidth,
      imageHeight
    );

  const sampleDomainExtension = 0.3;
  const minSampleDomain = 0 - sampleDomainExtension;
  const maxSampleDomain = 1 + sampleDomainExtension;
  const sampleStep = 1 / (resolutionOfLUT * 4);

  for (let i = minSampleDomain; i < maxSampleDomain; i += sampleStep) {
    for (let j = minSampleDomain; j < maxSampleDomain; j += sampleStep) {
      const undistortedCoordinate = { x: i * imageHeight, y: j * imageWidth };

      const { x: distortedX, y: distortedY } = distortCoordinateFisheye(
        undistortedCoordinate,
        intrinsicMatrix,
        coefficients,
        newIntrinsicMatrixInverse
      );

      const distortionLUTIndexX = Math.round(
        (distortedX / imageWidth) * (resolutionOfLUT - 1)
      );

      const distortionLUTIndexY = Math.round(
        (1 - distortedY / imageHeight) * (resolutionOfLUT - 1)
      );

      if (
        distortionLUTIndexX < 0 ||
        distortionLUTIndexX >= resolutionOfLUT ||
        distortionLUTIndexY < 0 ||
        distortionLUTIndexY >= resolutionOfLUT
      ) {
        continue;
      }

      const u = j;
      const v = 1 - i;
      rgbaDistortionLUT[
        distortionLUTIndexY * resolutionOfLUT * 4 + distortionLUTIndexX * 4
      ] = u;
      rgbaDistortionLUT[
        distortionLUTIndexY * resolutionOfLUT * 4 + distortionLUTIndexX * 4 + 1
      ] = v;
      // Blue and Alpha channels will remain 0.
    }
  }

  const distortionLUTData = new Float32Array(rgbaDistortionLUT);
  const distortionLUTTexture = new DataTexture(
    distortionLUTData,
    resolutionOfLUT,
    resolutionOfLUT,
    RGBAFormat,
    FloatType
  );
  // distortionLUTTexture.minFilter = LinearFilter;
  // distortionLUTTexture.magFilter = LinearFilter;
  distortionLUTTexture.needsUpdate = true;

  return distortionLUTTexture;
}

interface Coordinate {
  x: number;
  y: number;
}

function distortCoordinateFisheye(
  undistortedCoordinate: Coordinate,
  intrinsicMatrix: Matrix3,
  coefficients: FisheyeCoefficients,
  newIntrinsicMatrixInverse: Matrix3
): Coordinate {
  const { x, y } = undistortedCoordinate;
  const { k1, k2, k3, k4 } = coefficients;

  const fx = intrinsicMatrix.elements[0 + 0 * 3];
  const fy = intrinsicMatrix.elements[1 + 1 * 3];
  const cx = intrinsicMatrix.elements[0 + 2 * 3];
  const cy = intrinsicMatrix.elements[1 + 2 * 3];
  const iR = newIntrinsicMatrixInverse;

  let distortedX: number, distortedY: number;

  const _x =
    x * iR.elements[1 * 3 + 0] +
    y * iR.elements[0 * 3 + 0] +
    iR.elements[2 * 3 + 0];
  const _y =
    x * iR.elements[1 * 3 + 1] +
    y * iR.elements[0 * 3 + 1] +
    iR.elements[2 * 3 + 1];
  const _w =
    x * iR.elements[1 * 3 + 2] +
    y * iR.elements[0 * 3 + 2] +
    iR.elements[2 * 3 + 2];

  if (_w <= 0) {
    distortedX = _x > 0 ? -Infinity : Infinity;
    distortedY = _y > 0 ? -Infinity : Infinity;
  } else {
    const r = Math.sqrt(_x * _x + _y * _y);
    const theta = Math.atan(r);

    const theta2 = theta * theta;
    const theta4 = theta2 * theta2;
    const theta6 = theta4 * theta2;
    const theta8 = theta4 * theta4;
    const theta_d =
      theta * (1 + k1 * theta2 + k2 * theta4 + k3 * theta6 + k4 * theta8);

    const scale = r === 0 ? 1.0 : theta_d / r;
    distortedX = fx * _x * scale + cx;
    distortedY = fy * _y * scale + cy;
  }

  return { x: distortedX, y: distortedY };
}

function computeIntrinsicMatrixInverseWithZoomForDistortion(
  intrinsicMatrix: Matrix3,
  zoomForDistortionFactor: number,
  width: number,
  height: number
) {
  const principalPointOffsetX =
    (width / 2 - intrinsicMatrix.elements[0 + 2 * 3]) *
    (1 - zoomForDistortionFactor);
  const principalPointOffsetY =
    (height / 2 - intrinsicMatrix.elements[1 + 2 * 3]) *
    (1 - zoomForDistortionFactor);

  const newIntrinsicMatrix = [
    [
      intrinsicMatrix.elements[0 + 0 * 3] * zoomForDistortionFactor,
      0,
      intrinsicMatrix.elements[0 + 2 * 3] + principalPointOffsetX,
    ],
    [
      0,
      intrinsicMatrix.elements[1 + 1 * 3] * zoomForDistortionFactor,
      intrinsicMatrix.elements[1 + 2 * 3] + principalPointOffsetY,
    ],
    [0, 0, 1],
  ];

  const newIntrinsicMatrixInverse = new Matrix3()
    .fromArray(newIntrinsicMatrix.flat())
    .transpose()
    .invert();

  return newIntrinsicMatrixInverse;
}
