
import { uv, passTexture, uniform, max, QuadMesh, RenderTarget, Vector2, nodeObject, addNodeElement, NodeUpdateType, float, TempNode, div, vec2, tslFn, sub, mul } from 'three/tsl'

const _size = /*@__PURE__*/ new Vector2();
const _quadMesh = /*@__PURE__*/ new QuadMesh();

class BrownConradyDistortionNode extends TempNode {

	constructor(
		textureNode,
		coefficients,
		principalPoint,
		focalLength,
		imageDimensions,
		zoomForDistortionFactor = 1.0,
		relAspect = 1.0
	) {

		super(textureNode);

		this.textureNode = textureNode;

		this.zoomForDistortionFactor = uniform(zoomForDistortionFactor);
		this.coefficients = uniform(coefficients);
		this.principalPoint = uniform(principalPoint);
		this.focalLength = uniform(focalLength);
		this.imageDimensions = uniform(imageDimensions);
		this.relAspect = uniform(relAspect);

		this._rtt = new RenderTarget();
		this._rtt.texture.name = 'BrownConradyDistortionNode.comp';

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

		const {
			coefficients,
			principalPoint,
			focalLength,
			imageDimensions,
			relAspect,
			zoomForDistortionFactor
		} = this;

		const sampleDiffuse = (uv) => textureNode.uv(uv)

		const brownConradyDistortion = tslFn(() => {

			const relAspectFactorX = float(max(1.0, relAspect)).toVar();
			const relAspectFactorY = float(max(1.0, div(1.0, relAspect))).toVar();
			const relAspectOffsetX = float(sub(1.0, relAspectFactorX).div(2.0)).toVar();
			const relAspectOffsetY = float(sub(1.0, relAspectFactorY).div(2.0)).toVar();
			const inputCoordinatesWithAspectOffset = vec2(uvNode.x.mul(relAspectFactorX).add(relAspectOffsetX), uvNode.y.mul(relAspectFactorY).add(relAspectOffsetY)).toVar();
			const k1 = coefficients.x
			const k2 = coefficients.y
			const p1 = coefficients.z
			const p2 = coefficients.w

			const imageCoordinates = vec2(inputCoordinatesWithAspectOffset.mul(imageDimensions).sub(principalPoint).div(focalLength)).toVar();
			const x = float(imageCoordinates.x).toVar();
			const y = float(imageCoordinates.y).toVar();
			const r2 = float(x.mul(x).add(y.mul(y))).toVar();
			const r4 = float(r2.mul(r2)).toVar();
			const invFactor = float(div(1.0, mul(4.0, k1).mul(r2).add(mul(6.0, k2).mul(r4)).add(mul(8.0, p1).mul(y)).add(mul(8.0, p2).mul(x)).add(1.0))).toVar();
			const dx = float(x.mul(k1.mul(r2).add(k2.mul(r4))).add(mul(2.0, p1).mul(x).mul(y)).add(p2.mul(r2.add(mul(2.0, x).mul(x))))).toVar();
			const dy = float(y.mul(k1.mul(r2).add(k2.mul(r4))).add(p1.mul(r2.add(mul(2.0, y).mul(y)))).add(mul(2.0, p2).mul(x).mul(y))).toVar();
			x.subAssign(invFactor.mul(dx));
			y.subAssign(invFactor.mul(dy));


			const coordinates = vec2(x, y).toVar();

			const principalPointOffset = imageDimensions
				.div(2.0)
				.sub(principalPoint)
				.mul(zoomForDistortionFactor.oneMinus()).toVar('principalPointOffset');

			const outputCoordinates = vec2(
				coordinates
					.mul(focalLength)
					.mul(zoomForDistortionFactor)
					.add(principalPoint)
					.add(principalPointOffset)
			)
				.div(imageDimensions)
				.toVar('outputCoordinates');

			const coordinatesWithAspectOffset = vec2(
				float(outputCoordinates.x.sub(relAspectOffsetX)).div(relAspectFactorX),
				float(outputCoordinates.y.sub(relAspectOffsetY)).div(relAspectFactorY)
			).toVar('coordinatesWithAspectOffset');

			return sampleDiffuse(coordinatesWithAspectOffset)

		});

		//

		const materialComposed = this._materialComposed || (this._materialComposed = builder.createNodeMaterial());
		materialComposed.fragmentNode = brownConradyDistortion();


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

export const BrownConradyDistortion = (
	node,
	coefficients,
	principalPoint,
	focalLength,
	imageDimensions,
	zoomForDistortionFactor,
	relAspect
) => nodeObject(
	new BrownConradyDistortionNode(nodeObject(node).toTexture(),
		coefficients,
		principalPoint,
		focalLength,
		imageDimensions,
		zoomForDistortionFactor,
		relAspect
	));

addNodeElement('brownConradyDistortion', BrownConradyDistortion);

export default BrownConradyDistortionNode;

