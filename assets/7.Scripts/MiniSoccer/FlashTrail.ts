import { _decorator, CCFloat, Color, Component, Node, Quat, Sprite, SpriteFrame, Tween, tween, UITransform, Vec3 } from 'cc';
import { GameEvent, gameEvents, GameManager, GameState, MaxLevelFx } from './GameManager';
const { ccclass, property } = _decorator;

const _q = new Quat();
const _v = new Vec3();

/**
 * Hieu ung chay kieu The Flash khi max level (nhan vat co maxFx = Flash, vd Mbappe). Gan tren node Character.
 * - Bong mo (afterimage): moi lan nguoi lach ngang duoc ghostSpacing thi chup lai anh Body, de lai tren duong vua di
 *   -> thanh duoi bong noi tiep phia sau; dung im thi khong tao (tranh bong chong len nguoi). Doi mau xanh lo -> xanh duong roi tan.
 *   Bong nam trong trailLayer (con cua Rig, dat TRUOC Character) nen ve sau nguoi va giu vi tri cu khi keo ngang.
 * - Tia set xanh chop quanh nguoi (boltLayer, con cua Visuals, don vi px anh). Nguoi khong nghieng.
 */
@ccclass('FlashTrail')
export class FlashTrail extends Component {

    @property(Sprite)
    body: Sprite | null = null;

    @property({ type: Node, tooltip: 'Node chua bong mo: con cua Rig, nam TRUOC Character trong Hierarchy' })
    trailLayer: Node | null = null;

    @property({ type: Node, tooltip: 'Node chua tia set: con cua Visuals (ve truoc Body)' })
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

    private _on = false;
    private _boltAcc = 0;
    private _ghosts: Sprite[] = [];
    private _boltPool: Sprite[] = [];
    private _ghostX = 0;

    onLoad() {
        gameEvents.on(GameEvent.LEVEL_CHANGED, this.refresh, this);
        gameEvents.on(GameEvent.CHARACTER_SELECTED, this.refresh, this);
    }

    onDestroy() {
        gameEvents.targetOff(this);
        for (const s of [...this._ghosts, ...this._boltPool]) { Tween.stopAllByTarget(s); Tween.stopAllByTarget(s.node); }
    }

    private refresh(): void {
        const gm = GameManager.Ins;
        const on = !!gm && gm.character?.maxFx === MaxLevelFx.Flash && gm.level >= gm.maxLevel;
        if (on === this._on) return;
        this._on = on;
        this._ghostX = this.node.position.x;
    }

    update(dt: number) {
        if (!this._on || !this.body?.node.activeInHierarchy) return;
        const state = GameManager.Ins?.state;
        if (state !== GameState.Playing && state !== GameState.Ending) return;

        // Bong mo theo quang duong lach ngang: lach nhanh hay cham deu ra 1 duoi bong deu nhau, dung im thi khong co
        // Lach xa trong 1 khung (keo nhanh / fps thap) thi rai them bong tren doan vua di de duoi lien mach
        const x = this.node.position.x, dx = x - this._ghostX;
        const n = Math.min(12, Math.floor(Math.abs(dx) / this.ghostSpacing));
        for (let i = 1; i <= n; i++) this.spawnGhost(this._ghostX + dx * i / n - x);
        if (n > 0) this._ghostX = x;
        this._boltAcc += dt * this.boltRate;
        while (this._boltAcc >= 1) { this._boltAcc--; this.spawnBolt(); }
    }

    /** Chup anh Body hien tai (cung vi tri / scale world, lech ngang offsetX) thanh 1 bong mo, troi ve sau va tan. */
    private spawnGhost(offsetX = 0): void {
        const body = this.body!, layer = this.trailLayer;
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
            .call(() => this.release(this._ghosts, sp)).start();
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
            .call(() => this.release(this._boltPool, sp))
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

    private release(_pool: Sprite[], sp: Sprite): void {
        Tween.stopAllByTarget(sp);
        Tween.stopAllByTarget(sp.node);
        sp.node.active = false;
    }
}
