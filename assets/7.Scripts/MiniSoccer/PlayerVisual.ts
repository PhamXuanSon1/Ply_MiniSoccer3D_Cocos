import { _decorator, Animation, CCFloat, Color, Component, Sprite, Tween, tween, Vec3 } from 'cc';
import { GameEvent, gameEvents, GameManager } from './GameManager';
const { ccclass, property } = _decorator;

const _white = new Color(255, 255, 255, 255);

/**
 * Hinh cau thu theo level (PlayerVisual ben Unity). Gan tren node Character (goc o chan).
 * - Doi anh Body theo level, nhun Y lien tuc khi dang choi.
 * - Vua len max level: to x maxBoostScale + chay clip glow; het clip thi ve kich thuoc thuong.
 */
@ccclass('PlayerVisual')
export class PlayerVisual extends Component {

    @property(Sprite)
    body: Sprite | null = null;

    @property({ type: Animation, tooltip: 'Animation tren Visuals, chua clip glow' })
    animation: Animation | null = null;

    @property({ tooltip: 'Ten clip glow khi len max level' })
    glowClip = 'Character_MaxLevelGlow';

    @property({ type: [Sprite], tooltip: 'Cac lop glow (GlowRimBack, GlowWhiteFront, GlowHaloFront, GlowBurstFx) - an khi khong boost' })
    glowLayers: Sprite[] = [];

    @property({ type: [CCFloat], tooltip: 'He so scale theo level (phan tu 0 = Lv1)' })
    levelScales: number[] = [1, 1.06, 1.12, 1.18, 1.24];

    @property({ type: CCFloat, tooltip: 'Chieu cao Y khi nhun xuong' })
    bounceY = 0.95;

    @property({ type: CCFloat, tooltip: 'Thoi gian 1 lan nhun xuong / nay len (giay)' })
    bounceDuration = 0.4;

    @property({ type: CCFloat, tooltip: 'Thoi gian doi scale khi doi level (giay)' })
    scaleTransition = 0.25;

    @property({ type: CCFloat, tooltip: 'Phong to them khi vua len max level' })
    maxBoostScale = 1.4;

    private _defaultScale = new Vec3();
    private _level = 1;
    private _started = false;
    private _boosting = false;

    onLoad() {
        this._defaultScale.set(this.node.scale);
        this.resetGlow();
        this.setSprite(1);
        gameEvents.on(GameEvent.START, this.onStart, this);
        gameEvents.on(GameEvent.LEVEL_CHANGED, this.onLevelChanged, this);
        this.animation?.on(Animation.EventType.FINISHED, this.onGlowFinished, this);
    }

    onDestroy() {
        gameEvents.targetOff(this);
        Tween.stopAllByTarget(this.node);
    }

    private onStart(): void {
        this._started = true;
        this.startBouncing();
    }

    private onLevelChanged(level: number): void {
        const max = GameManager.Ins?.maxLevel ?? 5;
        const wasMax = this._level >= max;
        this._level = level;
        this.setSprite(level);
        if (level >= max && !wasMax) this.beginBoost();
        else if (level < max) this.cancelBoost();
        if (this._started) this.startBouncing();
    }

    private setSprite(level: number): void {
        const sprites = GameManager.Ins?.levelSprites ?? [];
        if (!this.body || sprites.length === 0) return;
        this.body.spriteFrame = sprites[Math.min(sprites.length, Math.max(1, level)) - 1];
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

    private beginBoost(): void {
        this._boosting = true;
        if (!this.animation || !this.animation.getState(this.glowClip)) { this._boosting = false; return; }
        for (const s of this.glowLayers) s.enabled = true;
        this.animation.play(this.glowClip);
    }

    /** Het clip glow (Unity: normalizedTime >= 1 -> EndMaxBoost). */
    private onGlowFinished(): void {
        if (!this._boosting) return;
        this._boosting = false;
        this.resetGlow(true);
        if (this._started) this.startBouncing();
    }

    private cancelBoost(): void {
        if (!this._boosting) return;
        this._boosting = false;
        this.animation?.stop();
        this.resetGlow();
    }

    /** Tra Body ve mau goc, an cac lop glow (fadeRim: vien mo dan nhu Unity). */
    private resetGlow(fadeRim = false): void {
        if (this.body) this.body.color = _white;
        this.glowLayers.forEach((s, i) => {
            Tween.stopAllByTarget(s);
            if (i === 0 && fadeRim && s.enabled) {
                tween(s).to(this.scaleTransition, { color: new Color(255, 255, 255, 0) })
                    .call(() => { s.enabled = false; }).start();
                return;
            }
            s.color = new Color(255, 255, 255, 0);
            s.node.setScale(1, 1, 1);
            s.enabled = false;
        });
    }
}
