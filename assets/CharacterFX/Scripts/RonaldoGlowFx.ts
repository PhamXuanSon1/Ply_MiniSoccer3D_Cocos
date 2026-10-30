import { _decorator, Animation, Color, Node, Quat, Sprite, Tween, tween, UITransform } from 'cc';
import { CharacterFx } from './CharacterFx';
const { ccclass, property } = _decorator;

const _q = new Quat();

/**
 * Hieu ung max level ban Ronaldo (prefab FX_Ronaldo_MaxLevel): clip Character_MaxLevelGlow cu
 * (silhouette trang chop, hao quang, burst) chay 1 lan khi vua len max, het clip thi vien mo dan.
 * Lop glow ve theo dang anh Ronaldo (Player/Glow_*), toa do theo anh 512px -> goc prefab scale 800/512.
 * Clip co track mau cho "Body": prefab co node Body gia (khong anh), mau cua no duoc chep sang Body that.
 * GlowRimBack phai ve sau Body nhung clip can no o trong prefab -> an no di, chep anh/mau/vi tri sang 1 sprite sau Body.
 */
@ccclass('RonaldoGlowFx')
export class RonaldoGlowFx extends CharacterFx {

    @property(Animation)
    animation: Animation | null = null;

    @property({ tooltip: 'Ten clip glow' })
    clip = 'Character_MaxLevelGlow';

    @property({ type: Sprite, tooltip: 'Node Body gia trong prefab (clip to mau len no)' })
    bodyTint: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'GlowRimBack trong prefab (an, chep sang sprite sau Body)' })
    rimBack: Sprite | null = null;

    @property({ type: [Sprite], tooltip: 'Cac lop glow ve truoc Body (GlowWhiteFront, GlowHaloFront, GlowBurstFx)' })
    frontLayers: Sprite[] = [];

    private _rimRelay: Sprite | null = null;
    private _playing = false;

    onLoad() {
        if (this.rimBack) this.rimBack.enabled = false;
        this.animation?.on(Animation.EventType.FINISHED, this.onFinished, this);
        this.reset();
    }

    onDestroy() {
        if (this._rimRelay) Tween.stopAllByTarget(this._rimRelay);
        super.onDestroy();
    }

    public bind(ctx: Parameters<CharacterFx['bind']>[0]): void {
        super.bind(ctx);
        const n = new Node('RonaldoRimBack');
        n.layer = ctx.body.node.layer;
        n.setParent(ctx.visuals);
        n.setSiblingIndex(ctx.body.node.getSiblingIndex());
        this.adopt(n);
        n.addComponent(UITransform);
        this._rimRelay = n.addComponent(Sprite);
        this._rimRelay.sizeMode = Sprite.SizeMode.CUSTOM;
        this._rimRelay.enabled = false;
    }

    public begin(): void {
        if (!this.animation?.getState(this.clip)) return;
        this._playing = true;
        for (const s of this.frontLayers) s.enabled = true;
        if (this._rimRelay) { Tween.stopAllByTarget(this._rimRelay); this._rimRelay.enabled = true; }
        this.animation.play(this.clip);
    }

    public end(): void {
        if (!this._playing) return;
        this.animation?.stop();
        this.reset();
    }

    lateUpdate() {
        if (!this._playing || !this.ctx) return;
        if (this.bodyTint) this.ctx.body.color = this.bodyTint.color;
        const src = this.rimBack, dst = this._rimRelay;
        if (src && dst) {
            dst.spriteFrame = src.spriteFrame;
            const a = src.getComponent(UITransform)!, b = dst.getComponent(UITransform)!;
            b.setContentSize(a.contentSize);
            b.setAnchorPoint(a.anchorPoint);
            dst.color = src.color;
            dst.node.setWorldPosition(src.node.worldPosition);
            dst.node.setWorldRotation(src.node.getWorldRotation(_q));
            dst.node.setWorldScale(src.node.worldScale);
        }
    }

    /** Het clip: Body ve mau goc, an lop truoc, vien sau mo dan (nhu ban Unity). */
    private onFinished(): void {
        if (!this._playing) return;
        const rim = this._rimRelay;
        this.reset();
        if (rim) {
            rim.enabled = true;
            tween(rim).to(0.25, { color: new Color(255, 255, 255, 0) }).call(() => { rim.enabled = false; }).start();
        }
    }

    private reset(): void {
        this._playing = false;
        if (this.ctx) this.ctx.body.color = Color.WHITE;
        for (const s of this.frontLayers) {
            s.color = new Color(255, 255, 255, 0);
            s.enabled = false;
        }
        if (this._rimRelay) { Tween.stopAllByTarget(this._rimRelay); this._rimRelay.enabled = false; }
    }
}
