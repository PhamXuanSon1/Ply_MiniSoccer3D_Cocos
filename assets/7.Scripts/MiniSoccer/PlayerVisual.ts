import { _decorator, CCFloat, Color, Component, Sprite, Tween, tween, Vec3 } from 'cc';
import { applyFrame, applyGlow, FrameBase } from './CharacterFrame';
import { CharacterConfig, GameEvent, gameEvents, GameManager, MaxLevelFx } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Hinh cau thu theo level (PlayerVisual ben Unity). Gan tren node Character (goc o chan).
 * - Doi anh Body theo level + nhan vat da chon (scale/offset rieng tung anh, xem CharacterFrame), nhun Y lien tuc khi dang choi.
 * - Max level: phong to nhe roi ve, hao quang theo dang anh hien tai (mau rieng tung nhan vat) sang dan va tho nhe,
 *   khong chop nhay. Hat nang luong do PowerAura lo.
 */
@ccclass('PlayerVisual')
export class PlayerVisual extends Component {

    @property(Sprite)
    body: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'Hao quang sau Body (GlowRimBack): dung anh glow cua CharacterFrame, to mau auraColor' })
    aura: Sprite | null = null;

    @property({ type: [CCFloat], tooltip: 'He so scale theo level (phan tu 0 = Lv1)' })
    levelScales: number[] = [1, 1.08, 1.16, 1.24];

    @property({ type: CCFloat, tooltip: 'Chieu cao Y khi nhun xuong' })
    bounceY = 0.95;

    @property({ type: CCFloat, tooltip: 'Thoi gian 1 lan nhun xuong / nay len (giay)' })
    bounceDuration = 0.4;

    @property({ type: CCFloat, tooltip: 'Thoi gian doi scale khi doi level (giay)' })
    scaleTransition = 0.25;

    @property({ type: CCFloat, tooltip: 'Phong to them luc vua len max level' })
    maxBoostScale = 1.15;

    @property({ type: CCFloat, tooltip: 'Thoi gian giu phong to truoc khi ve kich thuoc thuong (giay)' })
    maxBoostTime = 0.6;

    @property({ type: CCFloat, tooltip: 'Chu ky 1 nhip tho cua hao quang (giay)' })
    auraBreath = 1.2;

    private _defaultScale = new Vec3();
    private _bodyBase = new FrameBase();
    private _auraBase = new FrameBase();
    private _level = 1;
    private _started = false;
    private _boosting = false;
    private _auraOn = false;

    onLoad() {
        this._defaultScale.set(this.node.scale);
        // Body dat o goc Visuals (vi tri 0, scale 1); scale/offset tung anh lay tu CharacterFrame (giong CharacterTuner)
        if (this.body) this._bodyBase.pos.z = this.body.node.position.z;
        if (this.aura) this._auraBase.pos.z = this.aura.node.position.z;
        this.hideAura();
        gameEvents.on(GameEvent.CHARACTER_SELECTED, this.onCharacterSelected, this);
        gameEvents.on(GameEvent.START, this.onStart, this);
        gameEvents.on(GameEvent.LEVEL_CHANGED, this.onLevelChanged, this);
    }

    start() {
        this.setSprite(this._level);
    }

    onDestroy() {
        gameEvents.targetOff(this);
        Tween.stopAllByTarget(this.node);
        if (this.aura) { Tween.stopAllByTarget(this.aura); Tween.stopAllByTarget(this.aura.node); }
    }

    private get character(): CharacterConfig | null {
        return GameManager.Ins?.character ?? null;
    }

    private onCharacterSelected(): void {
        this.setSprite(this._level);
    }

    private onStart(): void {
        this._started = true;
        this.startBouncing();
    }

    private onLevelChanged(level: number): void {
        const max = GameManager.Ins?.maxLevel ?? 4;
        const wasMax = this._level >= max;
        this._level = level;
        this.setSprite(level);
        if (level >= max && !wasMax) this.beginBoost();
        else if (level < max) this.endBoost();
        if (this._started) this.startBouncing();
    }

    private setSprite(level: number): void {
        const f = this.character?.level(level) ?? null;
        if (!this.body || !f) return;
        applyFrame(this.body, f, this._bodyBase);
        if (this.aura && this._auraOn) applyGlow(this.aura, f, this.body, this._auraBase);
    }

    private targetScale(out: Vec3): Vec3 {
        const scales = this.levelScales;
        let k = scales.length > 0 ? scales[Math.min(scales.length, Math.max(1, this._level)) - 1] : 1;
        if (this._boosting) k *= this.maxBoostScale;
        return Vec3.multiplyScalar(out, this._defaultScale, k);
    }

    /** Doi scale muot (backOut) roi nhun Y lap vo han (DOScaleY Yoyo ben Unity). */
    private startBouncing(): void {
        const target = this.targetScale(new Vec3());
        const low = new Vec3(target.x, target.y * this.bounceY, target.z);
        Tween.stopAllByTarget(this.node);
        tween(this.node)
            .to(this.scaleTransition, { scale: target }, { easing: 'backOut' })
            .then(tween(this.node)
                .to(this.bounceDuration, { scale: low }, { easing: 'sineInOut' })
                .to(this.bounceDuration, { scale: target }, { easing: 'sineInOut' })
                .union()
                .repeatForever())
            .start();
    }

    /** Vua len max: phong to nhe 1 nhip roi ve, hao quang hien dan va giu (tho nhe) trong luc con max. */
    private beginBoost(): void {
        this._boosting = true;
        this.unschedule(this.endPop);
        this.scheduleOnce(this.endPop, this.maxBoostTime);
        this.showAura();
    }

    private endPop(): void {
        if (!this._boosting) return;
        this._boosting = false;
        if (this._started) this.startBouncing();
    }

    private endBoost(): void {
        this.unschedule(this.endPop);
        this._boosting = false;
        if (!this._auraOn || !this.aura) return;
        this._auraOn = false;
        const a = this.aura;
        Tween.stopAllByTarget(a);
        tween(a).to(0.3, { color: this.alpha(a.color, 0) })
            .call(() => { Tween.stopAllByTarget(a.node); a.node.active = false; }).start();
    }

    private showAura(): void {
        const a = this.aura, f = this.character?.level(this._level) ?? null;
        // Nhan vat dung hieu ung Flash (FlashTrail) thi khong co hao quang
        if (!a || !this.body || !f?.glow || this.character!.maxFx !== MaxLevelFx.Aura) return;
        this._auraOn = true;
        a.node.active = true;
        applyGlow(a, f, this.body, this._auraBase);
        const color = this.character!.auraColor, base = a.node.scale.clone();
        const big = Vec3.multiplyScalar(new Vec3(), base, 1.06);
        Tween.stopAllByTarget(a);
        Tween.stopAllByTarget(a.node);
        a.color = this.alpha(color, 0);
        a.node.setScale(Vec3.multiplyScalar(new Vec3(), base, 1.25));
        const half = this.auraBreath / 2;
        // Lan vao tu to -> vua, roi tho nhe (sang/toi + to/nho cham), khong nhay tat
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

    private hideAura(): void {
        this._auraOn = false;
        if (this.body) this.body.color = Color.WHITE;
        if (!this.aura) return;
        Tween.stopAllByTarget(this.aura);
        Tween.stopAllByTarget(this.aura.node);
        this.aura.node.active = false;
    }

    private alpha(c: Color, a: number): Color {
        return new Color(c.r, c.g, c.b, Math.round(a));
    }
}
