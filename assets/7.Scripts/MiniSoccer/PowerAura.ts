import { _decorator, CCFloat, CCInteger, Color, Component, Node, Sprite, SpriteFrame, Tween, tween, UITransform, Vec3 } from 'cc';
import { GameEvent, gameEvents, GameManager } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Hieu ung "full power" cua cau thu khi dat max level (thay ParticleSystem PowerFullPar cu).
 * Gan tren node PowerFullPar (con cua Visuals, ve truoc Body); backLayer la node ve sau Body.
 * Don vi = pixel anh Body (goc o chan). Sprite tao luc chay, dung lai (pool), khong can dat san trong scene.
 * - Vua len max: bung 1 vong hat ra xung quanh + vong sang duoi chan.
 * - Giu max: hat nang luong bay tu chan len (nua truoc, nua sau Body), sao lap lanh quanh nguoi, vong sang nhip tho.
 * - Tut level: ngung phun, hat dang bay tu tat.
 * Mau hat lay theo nhan vat (CharacterConfig.particleColors), khong co thi dung colors.
 */
@ccclass('PowerAura')
export class PowerAura extends Component {

    @property({ type: Node, tooltip: 'Node ve SAU Body (dat truoc Body trong Visuals)' })
    backLayer: Node | null = null;

    @property({ type: SpriteFrame, tooltip: 'Hat sang mem (Particle_Glow)' })
    glow: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Sao lap lanh (Star)' })
    star: SpriteFrame | null = null;

    @property({ type: [Color], tooltip: 'Mau hat mac dinh (nhan vat khong dat particleColors)' })
    colors: Color[] = [new Color(255, 190, 0, 255), new Color(255, 120, 20, 255), new Color(0, 200, 255, 255)];

    @property({ tooltip: 'Mau vong sang duoi chan mac dinh (nhan vat co auraColor thi dung mau do)' })
    ringColor = new Color(255, 170, 0, 235);

    @property({ type: CCFloat, tooltip: 'So hat phun moi giay khi giu max level' })
    rate = 30;

    @property({ type: CCInteger, tooltip: 'So hat bung ra luc vua len max' })
    burstCount = 16;

    @property({ type: CCFloat, tooltip: 'Nua be ngang vung phun quanh nguoi (px anh)' })
    halfWidth = 150;

    @property({ type: CCFloat, tooltip: 'Do cao hat bay toi (px anh)' })
    riseHeight = 480;

    @property({ type: CCFloat, tooltip: 'Kich thuoc hat (px)' })
    particleSize = 90;

    @property({ type: CCFloat, tooltip: 'Be ngang vong sang duoi chan (px anh)' })
    ringWidth = 420;

    private _on = false;
    private _acc = 0;
    private _starAcc = 0;
    private _pool: Sprite[] = [];
    private _ring: Sprite | null = null;
    private _colors: Color[] = [];

    onLoad() {
        gameEvents.on(GameEvent.LEVEL_CHANGED, this.onLevelChanged, this);
        this._ring = this.make(this.backLayer ?? this.node, this.glow);
        this._ring.node.active = false;
    }

    onDestroy() {
        gameEvents.targetOff(this);
        for (const s of [...this._pool, this._ring]) if (s) { Tween.stopAllByTarget(s); Tween.stopAllByTarget(s.node); }
    }

    update(dt: number) {
        if (!this._on) return;
        this._acc += dt * this.rate;
        while (this._acc >= 1) { this._acc--; this.spawnRise(); }
        this._starAcc += dt * 2.5;
        while (this._starAcc >= 1) { this._starAcc--; this.spawnStar(); }
    }

    private onLevelChanged(level: number): void {
        const on = level >= (GameManager.Ins?.maxLevel ?? 4);
        if (on === this._on) return;
        this._on = on;
        if (on) this.begin(); else this.end();
    }

    private begin(): void {
        this._acc = this._starAcc = 0;
        const own = GameManager.Ins?.character?.particleColors;
        this._colors = own && own.length > 0 ? own : this.colors;
        // Bung 1 vong hat quanh than nguoi (tam o giua nguoi)
        const cy = this.riseHeight * 0.48;
        for (let i = 0; i < this.burstCount; i++) {
            const a = (i / this.burstCount) * Math.PI * 2 + Math.random() * 0.3;
            const from = new Vec3(0, cy, 0);
            const to = new Vec3(Math.cos(a) * this.halfWidth * 2.1, cy + Math.sin(a) * this.riseHeight * 0.62, 0);
            this.fly(this.take(i % 2 === 0), from, to, 0.55, 1.3, 'quadOut');
        }
        const ring = this._ring;
        if (ring) {
            const n = ring.node, s = this.ringWidth / 90;
            n.active = true;
            n.setPosition(0, 0, 0);
            Tween.stopAllByTarget(n);
            Tween.stopAllByTarget(ring);
            const rc = GameManager.Ins?.character?.auraColor ?? this.ringColor;
            ring.color = this.alpha(rc, 0);
            n.setScale(s * 2, s * 0.6, 1);
            tween(ring).to(0.3, { color: this.alpha(rc, 235) }).start();
            tween(n).to(0.3, { scale: new Vec3(s * 9, s * 2.2, 1) }, { easing: 'backOut' })
                .then(tween(n)
                    .to(0.6, { scale: new Vec3(s * 10, s * 2.5, 1) }, { easing: 'sineInOut' })
                    .to(0.6, { scale: new Vec3(s * 9, s * 2.2, 1) }, { easing: 'sineInOut' })
                    .union().repeatForever())
                .start();
        }
    }

    private end(): void {
        const ring = this._ring;
        if (ring?.node.active) {
            Tween.stopAllByTarget(ring);
            tween(ring).to(0.3, { color: this.alpha(ring.color, 0) })
                .call(() => { Tween.stopAllByTarget(ring.node); ring.node.active = false; }).start();
        }
    }

    /** Hat bay tu chan len, lac ngang nhe, mo dan. Nua truoc nua sau Body. */
    private spawnRise(): void {
        const x = (Math.random() * 2 - 1) * this.halfWidth;
        const from = new Vec3(x, Math.random() * this.riseHeight * 0.12, 0);
        const to = new Vec3(x * 0.6 + (Math.random() * 2 - 1) * this.halfWidth * 0.25, this.riseHeight * (0.7 + Math.random() * 0.3), 0);
        // ~40% la sao (net, xoay) de noi tren nen sang; con lai la hat sang mem
        const isStar = !!this.star && Math.random() < 0.4;
        const sp = this.take(Math.random() < 0.5, isStar ? this.star : this.glow);
        this.fly(sp, from, to, 0.8 + Math.random() * 0.5, isStar ? 0.35 + Math.random() * 0.25 : 0.6 + Math.random() * 0.6, 'sineOut', isStar ? 360 : 0);
    }

    /** Sao nho chop o quanh nguoi. */
    private spawnStar(): void {
        if (!this.star) return;
        const sp = this.take(false, this.star);
        const n = sp.node, k = (0.35 + Math.random() * 0.3) * this.particleSize / 50;
        n.setPosition((Math.random() * 2 - 1) * this.halfWidth * 1.25, this.riseHeight * (0.15 + Math.random() * 0.85), 0);
        n.setScale(0, 0, 1);
        n.setRotationFromEuler(0, 0, Math.random() * 90);
        sp.color = this.alpha(this._colors[0] ?? Color.WHITE, 255);
        tween(n)
            .to(0.18, { scale: new Vec3(k, k, 1) }, { easing: 'backOut' })
            .delay(0.12)
            .to(0.2, { scale: new Vec3(0, 0, 1) }, { easing: 'quadIn' })
            .call(() => this.release(sp))
            .start();
    }

    private fly(sp: Sprite, from: Vec3, to: Vec3, time: number, size: number, easing: 'quadOut' | 'sineOut', spin = 0): void {
        const n = sp.node, k = size * this.particleSize / 10, c = this._colors[Math.floor(Math.random() * this._colors.length)] ?? Color.WHITE;
        n.setPosition(from);
        n.setScale(k, k, 1);
        n.setRotationFromEuler(0, 0, 0);
        sp.color = this.alpha(c, 0);
        tween(sp)
            .to(time * 0.2, { color: this.alpha(c, 255) })
            .delay(time * 0.4)
            .to(time * 0.4, { color: this.alpha(c, 0) })
            .start();
        tween(n)
            .to(time, { position: to, scale: new Vec3(k * 0.3, k * 0.3, 1), eulerAngles: new Vec3(0, 0, spin * (Math.random() < 0.5 ? 1 : -1)) }, { easing })
            .call(() => this.release(sp))
            .start();
    }

    private take(back: boolean, frame: SpriteFrame | null = this.glow): Sprite {
        const parent = back && this.backLayer ? this.backLayer : this.node;
        let sp = this._pool.pop();
        if (!sp) sp = this.make(parent, frame);
        else sp.node.setParent(parent);
        sp.spriteFrame = frame;
        sp.node.active = true;
        return sp;
    }

    private release(sp: Sprite): void {
        Tween.stopAllByTarget(sp);
        Tween.stopAllByTarget(sp.node);
        sp.node.active = false;
        this._pool.push(sp);
    }

    /** Sprite 10x10 (scale = kich thuoc / 10) de doi frame khong doi kich thuoc. */
    private make(parent: Node, frame: SpriteFrame | null): Sprite {
        const n = new Node('Fx');
        n.layer = this.node.layer;
        n.setParent(parent);
        n.addComponent(UITransform).setContentSize(10, 10);
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.trim = false;
        sp.spriteFrame = frame;
        return sp;
    }

    private alpha(c: Color, a: number): Color {
        return new Color(c.r, c.g, c.b, Math.round(a));
    }
}
