import { _decorator, CCFloat, Component, instantiate, Prefab, Sprite, Tween, tween, Vec3 } from 'cc';
import { applyFrame, FrameBase } from './CharacterFrame';
import { CharacterFx } from './CharacterFx';
import { CharacterConfig, GameEvent, gameEvents, GameManager } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Hinh cau thu theo level (PlayerVisual ben Unity). Gan tren node Character (goc o chan).
 * - Doi anh Body theo level + nhan vat da chon (scale/offset rieng tung anh, xem CharacterFrame), nhun Y lien tuc khi dang choi.
 * - Max level: phong to nhe roi ve + hieu ung rieng cua nhan vat: prefab CharacterConfig.maxLevelFx
 *   (FX_Ronaldo / FX_Mbappe / FX_Yamal ...), tao lam con cua Visuals khi chon nhan vat, goi begin/end/setFrame.
 */
@ccclass('PlayerVisual')
export class PlayerVisual extends Component {

    @property(Sprite)
    body: Sprite | null = null;

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

    private _defaultScale = new Vec3();
    private _bodyBase = new FrameBase();
    private _level = 1;
    private _started = false;
    private _boosting = false;
    private _fx: CharacterFx | null = null;
    private _fxPrefab: Prefab | null = null;

    onLoad() {
        this._defaultScale.set(this.node.scale);
        // Body dat o goc Visuals (vi tri 0, scale 1); scale/offset tung anh lay tu CharacterFrame (giong CharacterTuner)
        if (this.body) this._bodyBase.pos.z = this.body.node.position.z;
        gameEvents.on(GameEvent.CHARACTER_SELECTED, this.onCharacterSelected, this);
        gameEvents.on(GameEvent.START, this.onStart, this);
        gameEvents.on(GameEvent.LEVEL_CHANGED, this.onLevelChanged, this);
    }

    start() {
        this.applyFx();
        this.setSprite(this._level);
    }

    onDestroy() {
        gameEvents.targetOff(this);
        Tween.stopAllByTarget(this.node);
    }

    private get character(): CharacterConfig | null {
        return GameManager.Ins?.character ?? null;
    }

    private onCharacterSelected(): void {
        this.applyFx();
        this.setSprite(this._level);
    }

    /** Tao prefab hieu ung max level cua nhan vat dang chon (doi nhan vat thi huy cai cu). */
    private applyFx(): void {
        const prefab = this.character?.maxLevelFx ?? null;
        if (prefab === this._fxPrefab) return;
        this._fx?.dispose();
        this._fx = null;
        this._fxPrefab = prefab;
        const body = this.body, visuals = body?.node.parent, rig = this.node.parent;
        if (!prefab || !body || !visuals || !rig) return;
        const node = instantiate(prefab);
        node.setParent(visuals);
        this._fx = node.getComponent(CharacterFx);
        this._fx?.bind({ character: this.node, visuals, body, rig });
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
        this._fx?.setFrame(f);
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

    /** Vua len max: phong to nhe 1 nhip roi ve + bat hieu ung rieng cua nhan vat. */
    private beginBoost(): void {
        this._boosting = true;
        this.unschedule(this.endPop);
        this.scheduleOnce(this.endPop, this.maxBoostTime);
        this._fx?.begin();
    }

    private endPop(): void {
        if (!this._boosting) return;
        this._boosting = false;
        if (this._started) this.startBouncing();
    }

    private endBoost(): void {
        this.unschedule(this.endPop);
        this._boosting = false;
        this._fx?.end();
    }
}
