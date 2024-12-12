
import { uv, textureLoad, texture, passTexture, uniform, max, QuadMesh, RenderTarget, Vector2, nodeObject, addNodeElement, NodeUpdateType, float, vec4, TempNode, If, add, sub, div, vec2, Fn, vec3 } from 'three/tsl'

const _size = /*@__PURE__*/ new Vector2();
const _quadMesh = /*@__PURE__*/ new QuadMesh();

class FisheyeDistortionNode extends TempNode {

    constructor(textureNode, distortionLUT, relAspect = 1.0) {

        super(textureNode);

        this.textureNode = textureNode;
        this.distortionLUT = texture(distortionLUT);
        this.distortionLUT.setPrecision('high');

        this.relAspect = uniform(relAspect);

        this._pixelRatio = 1;
        this._width = 1;
        this._height = 1;

        this._rtt = new RenderTarget();
        this._rtt.texture.name = 'FisheyeDistortionNode.comp';

        this._textureNode = passTexture(this, this._rtt.texture);

        this.updateBeforeType = NodeUpdateType.RENDER;

    }

    getTextureNode() {

        return this._textureNode;

    }

    setSize(width, height) {

        this._width = width;
        this._height = height;

        const effectiveWidth = this._width * this._pixelRatio;
        const effectiveHeight = this._height * this._pixelRatio;

        this._rtt.setSize(effectiveWidth, effectiveHeight);

    }

    async updateBefore(frame) {

        const { renderer } = frame;

        this._pixelRatio = renderer.getPixelRatio();

        const size = renderer.getSize(_size);

        this.setSize(size.width, size.height);

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

        const fisheyeDistortion = Fn(() => {

            const relAspectFactorX = float(max(1.0, relAspect)).toVar();
            const relAspectFactorY = float(max(1.0, div(1.0, relAspect))).toVar();
            const relAspectOffsetX = float(sub(1.0, relAspectFactorX).div(2.0)).toVar();
            const relAspectOffsetY = float(sub(1.0, relAspectFactorY).div(2.0)).toVar();
            const inputCoordinatesWithAspectOffset = vec2(uvNode.x.mul(relAspectFactorX).add(relAspectOffsetX), uvNode.y.mul(relAspectFactorY).add(relAspectOffsetY)).toVar();

            // flip Y inputCoordinatesWithAspectOffset
            inputCoordinatesWithAspectOffset.y = sub(1.0, inputCoordinatesWithAspectOffset.y);

            const output = vec4(0.).toVar();

            const threshold = float(0.001).toVar();
            const outputCoordinates = sampleDistortionLUT(inputCoordinatesWithAspectOffset).toVar();

            If(inputCoordinatesWithAspectOffset.x.lessThanEqual(add(0.0, threshold)).or(inputCoordinatesWithAspectOffset.x.greaterThanEqual(sub(1.0, threshold))).or(inputCoordinatesWithAspectOffset.y.lessThanEqual(add(0.0, threshold))).or(inputCoordinatesWithAspectOffset.y.greaterThanEqual(sub(1.0, threshold))), () => {

                output.assign(vec4(0.0, 0.0, 0.0, 0.4));

            }).ElseIf(outputCoordinates.x.equal(0.0).and(outputCoordinates.y.equal(0.0)), () => {

                output.assign(vec4(0.0, 0.0, 0.0, 0.4));

            }).Else(() => {

                const coordinatesWithAspectOffset = vec2(float(outputCoordinates.x.sub(relAspectOffsetX)).div(relAspectFactorX), float(outputCoordinates.y.sub(relAspectOffsetY)).div(relAspectFactorY)).toVar();
                coordinatesWithAspectOffset.y = sub(1.0, coordinatesWithAspectOffset.y);
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

export default FisheyeDistortionNode;

