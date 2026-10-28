import { _decorator, Component, Material, MeshRenderer, Vec2, Vec4 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Cuon texture cua MeshRenderer theo thoi gian (MaterialUVScroller ben Unity).
 * Dung material instance, doi phan offset (zw) cua uniform tilingOffset.
 */
@ccclass('UVScroller')
export class UVScroller extends Component {

    @property({ tooltip: 'Toc do cuon UV moi giay' })
    speed = new Vec2(0.05, 0.05);

    private _mat: Material | null = null;
    private _to = new Vec4(1, 1, 0, 0);

    start() {
        this._mat = this.getComponent(MeshRenderer)?.getMaterialInstance(0) ?? null;
        const cur = this._mat?.getProperty('tilingOffset') as Vec4 | undefined;
        if (cur) this._to.set(cur);
    }

    update(dt: number) {
        if (!this._mat) return;
        // Giu offset trong [0,1) de khong mat do chinh xac khi chay lau
        this._to.z = (this._to.z + this.speed.x * dt) % 1;
        this._to.w = (this._to.w + this.speed.y * dt) % 1;
        this._mat.setProperty('tilingOffset', this._to);
    }
}
