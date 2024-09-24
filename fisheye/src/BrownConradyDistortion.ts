const BrownConradyDistortionShader = {
  uniforms: {
    tDiffuse: { value: null }, // The texture of the image to be distorted (automatically assigned by ShaderPass)
    uCoefficients: { value: [0, 0, 0, 0, 0] }, // k1, k2, p1, p2, k3
    uPrincipalPoint: { value: null },
    uFocalLength: { value: null },
    uImageWidth: { value: 0 },
    uImageHeight: { value: 0 },
    uRelAspect: { value: 1.0 },
    uZoomForDistortionFactor: { value: 1.0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uCoefficients[5];
    uniform vec2 uPrincipalPoint;
    uniform vec2 uFocalLength;
    uniform float uImageWidth;
    uniform float uImageHeight;
    uniform float uRelAspect;
    uniform float uZoomForDistortionFactor;
    varying vec2 vUv;

    void main() {
      float relAspectFactorX = max(1.0, uRelAspect);
      float relAspectFactorY = max(1.0, 1.0 / uRelAspect);
      float relAspectOffsetX = ((1.0 - relAspectFactorX) / 2.0);
      float relAspectOffsetY = ((1.0 - relAspectFactorY) / 2.0);
      vec2 inputCoordinatesWithAspectOffset = vec2(vUv.x * relAspectFactorX + relAspectOffsetX, vUv.y * relAspectFactorY + relAspectOffsetY);
      
      float k1 = uCoefficients[0];
      float k2 = uCoefficients[1];
      float p1 = uCoefficients[2];
      float p2 = uCoefficients[3];

      vec2 imageCoordinates = (inputCoordinatesWithAspectOffset * vec2(uImageWidth, uImageHeight) - uPrincipalPoint) / uFocalLength;
      float x = imageCoordinates.x;
      float y = imageCoordinates.y;
      float r2 = x * x + y * y;
      float r4 = r2 * r2;

      float invFactor = 1.0 / (4.0 * k1 * r2 + 6.0 * k2 * r4 + 8.0 * p1 * y + 8.0 * p2 * x + 1.0);
      float dx = x * (k1 * r2 + k2 * r4) + 2.0 * p1 * x * y + p2 * (r2 + 2.0 * x * x);
      float dy = y * (k1 * r2 + k2 * r4) + p1 * (r2 + 2.0 * y * y) + 2.0 * p2 * x * y;
      x -= invFactor * dx;
      y -= invFactor * dy;
      vec2 coordinates = vec2(x, y);

      vec2 principalPointOffset = vec2((uImageWidth / 2.0) - uPrincipalPoint.x, (uImageHeight / 2.0) - uPrincipalPoint.y) * (1.0 - uZoomForDistortionFactor);
      vec2 outputCoordinates = (coordinates * uFocalLength * uZoomForDistortionFactor + uPrincipalPoint + principalPointOffset) / vec2(uImageWidth, uImageHeight);
      
      vec2 coordinatesWithAspectOffset = vec2((outputCoordinates.x - relAspectOffsetX) / relAspectFactorX, (outputCoordinates.y - relAspectOffsetY) / relAspectFactorY);
      gl_FragColor = texture2D(tDiffuse, coordinatesWithAspectOffset);
    }
  `,
};

export { BrownConradyDistortionShader };
