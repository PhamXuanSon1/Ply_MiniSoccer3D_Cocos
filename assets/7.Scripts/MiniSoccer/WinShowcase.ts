import { _decorator, CCFloat, Color, Component, Node, Sprite, Tween, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Hieu ung lam dep anh thang (Ronaldo ngai vang): chop sang -> tia sang xoay + hao quang nhip tho + sao lap lanh.
 * Gan tren node WinFx (con cua Boss). EndSequence goi play() luc hien anh ket qua khi thang.
 * Cac node con dat san trong scene; script chi bat va chay tween.
 */
@ccclass('WinShowcase')
export class WinShowcase extends Component {

    @property({ type: Sprite, tooltip: 'Tia sang xoay cham sau anh' })
    rays: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'Hao quang tron sau anh, sang toi nhip nhang' })
    glow: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'Chop sang truoc anh luc vua hien' })
    flash: Sprite | null = null;

    @property({ type: [Sprite], tooltip: 'Sao lap lanh quanh anh' })
    stars: Sprite[] = [];

    @property({ type: CCFloat, tooltip: 'Do/giay tia sang xoay' })
    raySpeed = 25;

    private _spin = false;
    private _scales = new Map<Node, Vec3>();

    onLoad() {
        for (const s of this.all()) {
            this._scales.set(s.node, s.node.scale.clone());
            s.node.active = false;
        }
    }

    onDestroy() {
        for (const s of this.all()) { Tween.stopAllByTarget(s); Tween.stopAllByTarget(s.node); }
    }

    public play(): void {
        this.node.active = true;

        if (this.flash) {
            const f = this.flash, base = this._scales.get(f.node)!;
            f.node.active = true;
            f.color = this.alpha(f.color, 255);
            f.node.setScale(Vec3.multiplyScalar(new Vec3(), base, 0.4));
            tween(f.node).to(0.35, { scale: Vec3.multiplyScalar(new Vec3(), base, 1.6) }, { easing: 'quadOut' }).start();
            tween(f).delay(0.1).to(0.4, { color: this.alpha(f.color, 0) }).call(() => { f.node.active = false; }).start();
        }

        if (this.rays) {
            const r = this.rays, base = this._scales.get(r.node)!, a = r.color.a || 255;
            r.node.active = true;
            r.color = this.alpha(r.color, 0);
            r.node.setScale(Vec3.multiplyScalar(new Vec3(), base, 0.3));
            tween(r.node).to(0.5, { scale: base }, { easing: 'backOut' }).start();
            tween(r).to(0.4, { color: this.alpha(r.color, a) }).start();
            this._spin = true;
        }

        if (this.glow) {
            const g = this.glow, base = this._scales.get(g.node)!, a = g.color.a || 255;
            g.node.active = true;
            g.color = this.alpha(g.color, a);
            g.node.setScale(base);
            tween(g.node).repeatForever(tween(g.node)
                .to(0.8, { scale: Vec3.multiplyScalar(new Vec3(), base, 1.12) }, { easing: 'sineInOut' })
                .to(0.8, { scale: base }, { easing: 'sineInOut' })).start();
            tween(g).repeatForever(tween(g)
                .to(0.8, { color: this.alpha(g.color, a * 0.55) }, { easing: 'sineInOut' })
                .to(0.8, { color: this.alpha(g.color, a) }, { easing: 'sineInOut' })).start();
        }

        this.stars.forEach((s, i) => {
            const base = this._scales.get(s.node)!;
            s.node.active = true;
            s.node.setScale(0, 0, 0);
            // Moi sao nhay lech pha nhau
            tween(s.node).delay(0.2 + i * 0.22).repeatForever(tween(s.node)
                .to(0.35, { scale: base }, { easing: 'backOut' })
                .delay(0.25)
                .to(0.3, { scale: new Vec3(0, 0, 0) }, { easing: 'quadIn' })
                .delay(0.5 + (i % 3) * 0.2)).start();
        });
    }

    update(dt: number) {
        if (this._spin && this.rays) {
            const n = this.rays.node;
            n.setRotationFromEuler(0, 0, n.eulerAngles.z - this.raySpeed * dt);
        }
    }

    private all(): Sprite[] {
        return [this.rays, this.glow, this.flash, ...this.stars].filter((s): s is Sprite => !!s);
    }

    private alpha(c: Color, a: number): Color {
        return new Color(c.r, c.g, c.b, Math.round(a));
    }
}
