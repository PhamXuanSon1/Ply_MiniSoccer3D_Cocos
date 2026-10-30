import { _decorator, CCFloat, Color, Sprite, Tween, tween, Vec3 } from 'cc';
import { applyGlow, CharacterFrame, FrameBase } from './CharacterFrame';
import { CharacterFx } from './CharacterFx';
import { PowerAura } from './PowerAura';
const { ccclass, property } = _decorator;

/**
 * Hieu ung max level kieu hao quang (prefab FX_Yamal_MaxLevel).
 * Hao quang = anh glow cua CharacterFrame hien tai (silhouette mo, ply24/Glow), to mau auraColor, dat sau Body:
 * lan vao tu to -> vua roi tho nhe (sang/toi + to/nho cham), khong chop nhay. Kem hat nang luong (PowerAura).
 */
@ccclass('AuraFx')
export class AuraFx extends CharacterFx {

    @property({ type: Sprite, tooltip: 'Sprite hao quang (nam trong behindBody)' })
    aura: Sprite | null = null;

    @property({ tooltip: 'Mau hao quang' })
    auraColor = new Color(185, 90, 255, 220);

    @property({ type: CCFloat, tooltip: 'Chu ky 1 nhip tho cua hao quang (giay)' })
    breath = 1.2;

    @property({ type: PowerAura, tooltip: 'Hat nang luong (tuy chon)' })
    power: PowerAura | null = null;

    private _on = false;
    private _frame: CharacterFrame | null = null;
    private _base = new FrameBase();

    onLoad() {
        if (this.aura) {
            this._base.pos.z = this.aura.node.position.z;
            this.aura.node.active = false;
        }
    }

    onDestroy() {
        if (this.aura) { Tween.stopAllByTarget(this.aura); Tween.stopAllByTarget(this.aura.node); }
        super.onDestroy();
    }

    public setFrame(frame: CharacterFrame | null): void {
        this._frame = frame;
        if (this._on && this.aura && this.ctx) applyGlow(this.aura, frame, this.ctx.body, this._base);
    }

    public begin(): void {
        this._on = true;
        this.power?.begin();
        const a = this.aura, f = this._frame;
        if (!a || !this.ctx || !f?.glow) return;
        a.node.active = true;
        applyGlow(a, f, this.ctx.body, this._base);
        const color = this.auraColor, base = a.node.scale.clone();
        const big = Vec3.multiplyScalar(new Vec3(), base, 1.06);
        const half = this.breath / 2;
        Tween.stopAllByTarget(a);
        Tween.stopAllByTarget(a.node);
        a.color = this.alpha(color, 0);
        a.node.setScale(Vec3.multiplyScalar(new Vec3(), base, 1.25));
        tween(a).to(0.4, { color: this.alpha(color, color.a) }, { easing: 'quadOut' })
            .then(tween(a)
                .to(half, { color: this.alpha(color, color.a * 0.7) }, { easing: 'sineInOut' })
                .to(half, { color: this.alpha(color, color.a) }, { easing: 'sineInOut' })
                .union().repeatForever())
            .start();
        tween(a.node).to(0.4, { scale: base }, { easing: 'quadOut' })
            .then(tween(a.node)
                .to(half, { scale: big }, { easing: 'sineInOut' })
                .to(half, { scale: base }, { easing: 'sineInOut' })
                .union().repeatForever())
            .start();
    }

    public end(): void {
        this._on = false;
        this.power?.end();
        const a = this.aura;
        if (!a?.node.active) return;
        Tween.stopAllByTarget(a);
        tween(a).to(0.3, { color: this.alpha(a.color, 0) })
            .call(() => { Tween.stopAllByTarget(a.node); a.node.active = false; }).start();
    }

    private alpha(c: Color, a: number): Color {
        return new Color(c.r, c.g, c.b, Math.round(a));
    }
}
