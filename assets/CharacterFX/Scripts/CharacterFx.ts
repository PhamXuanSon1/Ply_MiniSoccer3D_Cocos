import { _decorator, Component, Node, Sprite } from 'cc';
import { CharacterFrame } from './CharacterFrame';
const { ccclass, property } = _decorator;

/** Cac node cua cau thu ma hieu ung can biet (CharacterFxHost truyen vao khi gan prefab). */
export interface FxContext {
    /** Node Character (vi tri ngang cua cau thu). */
    character: Node;
    /** Node Visuals (goc o chan, don vi = px anh 800). Prefab hieu ung duoc dat lam con cua node nay. */
    visuals: Node;
    body: Sprite;
    /** Node Rig (chay theo truc z cung camera). */
    rig: Node;
}

/**
 * Nen cho prefab hieu ung max level cua tung nhan vat (FX_Ronaldo / FX_Mbappe / FX_Yamal ...).
 * CharacterFxHost instantiate prefab lam con cua Visuals, goi bind() roi:
 *   setFrame() moi lan doi anh, begin() khi vua len max level, end() khi tut khoi max level.
 * Node trong behindBody duoc dua ra Visuals, nam ngay truoc Body (ve sau nguoi);
 * node trong behindCharacter duoc dua ra Rig, nam truoc Character (khong chay ngang theo nguoi, vd duoi bong mo).
 * Doi hieu ung: CharacterFxHost goi dispose() de huy prefab cung cac node da dua ra ngoai.
 * Lam hieu ung moi: ke thua class nay, override setFrame / begin / end.
 */
@ccclass('CharacterFx')
export class CharacterFx extends Component {

    @property({ type: [Node], tooltip: 'Node con can ve SAU Body (duoc dua ra Visuals, ngay truoc Body)' })
    behindBody: Node[] = [];

    @property({ type: [Node], tooltip: 'Node con dat o Rig, truoc Character (giu vi tri cu khi keo ngang)' })
    behindCharacter: Node[] = [];

    protected ctx: FxContext | null = null;
    private _moved: Node[] = [];

    /** Cac node hieu ung dang nam ngoai goc prefab (behindBody / behindCharacter / node tu tao qua adopt). */
    public get movedNodes(): readonly Node[] { return this._moved; }

    public bind(ctx: FxContext): void {
        this.ctx = ctx;
        for (const n of this.behindBody) {
            n.setParent(ctx.visuals, true);
            n.setSiblingIndex(ctx.body.node.getSiblingIndex());
            this._moved.push(n);
        }
        for (const n of this.behindCharacter) {
            n.setParent(ctx.rig, false);
            n.setPosition(0, 0, 0);
            n.setSiblingIndex(ctx.character.getSiblingIndex());
            this._moved.push(n);
        }
    }

    /** Node hieu ung tu tao nam ngoai goc prefab: huy cung dispose(). */
    protected adopt(n: Node): void {
        this._moved.push(n);
    }

    /** Anh Body vua doi (theo level). */
    public setFrame(_frame: CharacterFrame | null): void {}

    /** Vua len max level. */
    public begin(): void {}

    /** Tut khoi max level. */
    public end(): void {}

    /** Huy hieu ung: ca goc prefab lan cac node da dua ra Visuals / Rig. */
    public dispose(): void {
        for (const n of this._moved) if (n.isValid) n.destroy();
        this._moved.length = 0;
        if (this.node.isValid) this.node.destroy();
    }

    onDestroy() {
        for (const n of this._moved) if (n.isValid) n.destroy();
        this._moved.length = 0;
    }
}
