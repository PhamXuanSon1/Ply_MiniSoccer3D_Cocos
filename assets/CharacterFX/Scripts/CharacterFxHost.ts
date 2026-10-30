import { _decorator, Component, instantiate, Node, Prefab, Sprite } from 'cc';
import { CharacterFrame } from './CharacterFrame';
import { CharacterFx } from './CharacterFx';
const { ccclass, property } = _decorator;

/**
 * Gan hieu ung max level (prefab FX_*_MaxLevel) cho 1 nhan vat. Dung duoc o project khac, khong phu thuoc game.
 * Gan tren node nhan vat (node chay ngang theo ngon tay). Cau truc can co:
 *   Rig (dung yen theo chieu ngang)      <- rig, mac dinh = cha cua node nay
 *     Character  [CharacterFxHost]        <- node nay
 *       Visuals (goc o chan)              <- cha cua body; prefab hieu ung duoc tao lam con cua node nay
 *         Body [Sprite]                   <- body
 * Goi tu code game:
 *   setPrefab(prefab)  doi hieu ung (doi nhan vat)
 *   setFrame(frame)    moi lan doi anh Body (AuraFx can frame.glow de ve hao quang theo dang nguoi)
 *   setMaxLevel(on)    true khi vua len max level, false khi tut
 */
@ccclass('CharacterFxHost')
export class CharacterFxHost extends Component {

    @property({ type: Sprite, tooltip: 'Sprite nhan vat (Body); cha cua no la Visuals' })
    body: Sprite | null = null;

    @property({ type: Prefab, tooltip: 'Prefab hieu ung luc dau (co the doi bang setPrefab)' })
    fxPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: 'Node dung yen theo chieu ngang (de bong mo o lai phia sau); bo trong = cha cua node nay' })
    rig: Node | null = null;

    private _fx: CharacterFx | null = null;
    private _prefab: Prefab | null = null;
    private _frame: CharacterFrame | null = null;
    private _max = false;

    public get fx(): CharacterFx | null { return this._fx; }

    start() {
        if (this.fxPrefab && !this._prefab) this.setPrefab(this.fxPrefab);
    }

    onDestroy() {
        this._fx?.dispose();
        this._fx = null;
    }

    /**
     * Doi prefab hieu ung (huy cai cu, ke ca node da dua ra ngoai). Dang max level thi hieu ung moi chay luon.
     * onSpawn: goi ngay sau khi tao node, truoc bind (cong cu xem thu trong editor dung de goi onLoad bang tay).
     */
    public setPrefab(prefab: Prefab | null, onSpawn?: (node: Node) => void): void {
        if (prefab === this._prefab) return;
        this._fx?.dispose();
        this._fx = null;
        this._prefab = prefab;
        const body = this.body, visuals = body?.node.parent, rig = this.rig ?? this.node.parent;
        if (!prefab || !body || !visuals || !rig) return;
        const node = instantiate(prefab);
        node.setParent(visuals);
        onSpawn?.(node);
        this._fx = node.getComponent(CharacterFx);
        if (!this._fx) { console.warn('[CharacterFxHost] Prefab khong co component CharacterFx:', prefab.name); return; }
        this._fx.bind({ character: this.node, visuals, body, rig });
        this._fx.setFrame(this._frame);
        if (this._max) this._fx.begin();
    }

    public setFrame(frame: CharacterFrame | null): void {
        this._frame = frame;
        this._fx?.setFrame(frame);
    }

    public setMaxLevel(on: boolean): void {
        if (on === this._max) return;
        this._max = on;
        if (on) this._fx?.begin(); else this._fx?.end();
    }
}
