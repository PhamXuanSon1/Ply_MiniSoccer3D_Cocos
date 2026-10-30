import { _decorator, CCFloat, Color, Node, Quat, Sprite, SpriteFrame, Tween, tween, UITransform, Vec3 } from 'cc';
import { CharacterFx } from './CharacterFx';
import { PowerAura } from './PowerAura';
const { ccclass, property } = _decorator;

const _q = new Quat();
const _v = new Vec3();

/**
 * Hieu ung max level kieu The Flash (prefab FX_Mbappe_MaxLevel). Khong co hao quang.
 * - Bong mo (afterimage): moi lan nguoi lach ngang duoc ghostSpacing thi chup lai anh Body, de lai tren duong vua di
 *   -> thanh duoi bong noi tiep phia sau; dung im thi khong tao (tranh bong chong len nguoi).
 *   Bong nam trong trailLayer (trong behindCharacter -> con cua Rig, truoc Character) nen ve sau nguoi va giu vi tri cu.
 * - Tia set chop quanh nguoi (boltLayer, ve truoc Body, don vi px anh). Nguoi khong nghieng.
 * - Hat nang luong (PowerAura, tuy chon).
 */
@ccclass('FlashTrail')
export class FlashTrail extends CharacterFx {

    @property({ type: Node, tooltip: 'Node chua bong mo (nam trong behindCharacter)' })
    trailLayer: Node | null = null;

    @property({ type: Node, tooltip: 'Node chua tia set (ve truoc Body)' })
    boltLayer: Node | null = null;

    @property({ type: [SpriteFrame], tooltip: 'Anh tia set (FX/Flash/Bolt_*)' })
    bolts: SpriteFrame[] = [];

    @property({ type: CCFloat, tooltip: 'Lach ngang duoc bao xa (don vi world) thi tao 1 bong mo; nho = duoi day hon' })
    ghostSpacing = 0.025;

    @property({ type: CCFloat, tooltip: 'Thoi gian 1 bong mo ton tai (giay); lon = duoi dai hon' })
    ghostLife = 0.4;

    @property({ type: CCFloat, tooltip: 'Bong mo troi ve phia camera bao nhieu (don vi world) trong 1 doi' })
    ghostDrift = 0.1;

    @property({ tooltip: 'Mau bong mo luc vua tao' })
    ghostStart = new Color(150, 235, 255, 150);

    @property({ tooltip: 'Mau bong mo luc tan' })
    ghostEnd = new Color(24, 150, 230, 0);

    @property({ type: CCFloat, tooltip: 'So tia set moi giay' })
    boltRate = 9;

    @property({ type: PowerAura, tooltip: 'Hat nang luong (tuy chon)' })
    power: PowerAura | null = null;

    private _on = false;
    private _boltAcc = 0;
    private _ghosts: Sprite[] = [];
    private _boltPool: Sprite[] = [];
    private _ghostX = 0;

    onDestroy() {
        for (const s of [...this._ghosts, ...this._boltPool]) { Tween.stopAllByTarget(s); Tween.stopAllByTarget(s.node); }
        super.onDestroy();
    }

    public begin(): void {
        this._on = true;
        this._ghostX = this.ctx?.character.position.x ?? 0;
        this.power?.begin();
    }

    public end(): void {
        this._on = false;
        this.power?.end();
    }

    update(dt: number) {
        const ctx = this.ctx;
        // Body bi an (canh danh Boss, endcard) thi ngung tao bong / tia set
        if (!this._on || !ctx || !ctx.body.node.activeInHierarchy) return;

        // Bong mo theo quang duong lach ngang: lach nhanh hay cham deu ra 1 duoi bong deu nhau, dung im thi khong co
        // Lach xa trong 1 khung (keo nhanh / fps thap) thi rai them bong tren doan vua di de duoi lien mach
        const x = ctx.character.position.x, dx = x - this._ghostX;
        const n = Math.min(12, Math.floor(Math.abs(dx) / this.ghostSpacing));
        for (let i = 1; i <= n; i++) this.spawnGhost(this._ghostX + dx * i / n - x);
        if (n > 0) this._ghostX = x;
        this._boltAcc += dt * this.boltRate;
        while (this._boltAcc >= 1) { this._boltAcc--; this.spawnBolt(); }
    }

    /** Chup anh Body hien tai (cung vi tri / scale world, lech ngang offsetX) thanh 1 bong mo, troi ve sau va tan. */
    private spawnGhost(offsetX = 0): void {
        const body = this.ctx!.body, layer = this.trailLayer;
        if (!layer || !body.spriteFrame) return;
        const sp = this.take(this._ghosts, layer);
        const n = sp.node, bt = body.getComponent(UITransform)!;
        const ut = n.getComponent(UITransform)!;
        sp.spriteFrame = body.spriteFrame;
        ut.setContentSize(bt.contentSize);
        ut.setAnchorPoint(bt.anchorX, bt.anchorY);
        n.setWorldPosition(_v.set(body.node.worldPosition).add3f(offsetX, 0, 0));
        n.setWorldRotation(body.node.getWorldRotation(_q));
        n.setWorldScale(body.node.worldScale);
        sp.color = this.ghostStart;
        const p = n.position;
        tween(sp).to(this.ghostLife, { color: this.ghostEnd }, { easing: 'quadIn' }).start();
        tween(n).to(this.ghostLife, { position: _v.set(p.x, p.y, p.z + this.ghostDrift).clone() }, { easing: 'quadOut' })
            .call(() => this.release(sp)).start();
    }

    /** Tia set chop 2 nhip roi tat, vi tri / goc / co ngau nhien quanh nguoi. */
    private spawnBolt(): void {
        const layer = this.boltLayer;
        if (!layer || this.bolts.length === 0) return;
        const sp = this.take(this._boltPool, layer);
        const n = sp.node;
        sp.spriteFrame = this.bolts[Math.floor(Math.random() * this.bolts.length)];
        n.getComponent(UITransform)!.setContentSize(sp.spriteFrame.originalSize);
        n.setPosition((Math.random() * 2 - 1) * 240, 80 + Math.random() * 620, 1);
        const k = 0.7 + Math.random() * 0.7;
        n.setScale(Math.random() < 0.5 ? -k : k, k, 1);
        n.setRotationFromEuler(0, 0, (Math.random() * 2 - 1) * 70);
        const on = new Color(255, 255, 255, 255), off = new Color(255, 255, 255, 0);
        sp.color = on;
        tween(sp)
            .delay(0.05).set({ color: off })
            .delay(0.04).set({ color: on })
            .to(0.12, { color: off })
            .call(() => this.release(sp))
            .start();
    }

    private take(pool: Sprite[], parent: Node): Sprite {
        const free = pool.find(s => !s.node.active);
        if (free) { free.node.active = true; return free; }
        const n = new Node('Fx');
        n.layer = parent.layer;
        n.setParent(parent);
        n.addComponent(UITransform);
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.trim = false;
        pool.push(sp);
        return sp;
    }

    private release(sp: Sprite): void {
        Tween.stopAllByTarget(sp);
        Tween.stopAllByTarget(sp.node);
        sp.node.active = false;
    }
}
