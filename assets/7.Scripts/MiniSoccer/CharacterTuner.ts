import { _decorator, CCFloat, CCInteger, CCObject, Color, Component, director, Enum, Node, Sprite, UITransform } from 'cc';
import { EDITOR } from 'cc/env';
import { applyFrame, applyGlow, CharacterFrame, FrameBase } from '../../CharacterFX/Scripts/CharacterFrame';
import { AuraFx } from '../../CharacterFX/Scripts/AuraFx';
import { CharacterConfig, GameManager } from './GameManager';
import { PlayerVisual } from './PlayerVisual';
const { ccclass, property, executeInEditMode } = _decorator;

/** Anh can xem: Lv1..Lv4 hoac anh thang. */
export enum TunerFrame { Lv1, Lv2, Lv3, Lv4, Lv5, Win }
Enum(TunerFrame);

/** Anh so sanh (ve mo phia sau). */
export enum TunerCompare { None, Lv1, Lv2, Lv3, Lv4, Lv5, Win }
Enum(TunerCompare);

/**
 * CONG CU CHINH ANH NHAN VAT (chi chay trong editor, khong anh huong game).
 * Gan tren node Character (cung PlayerVisual). Cach dung:
 *  1. Chon character (0/1 theo GameManager.characters) + frame can chinh -> Body trong Scene hien anh do.
 *  2. Chon compare = 1 anh khac -> anh do ve mo phia sau de so kich thuoc / vi tri chan.
 *  3. Sua scale / offset cua anh dang xem trong GameManager > Characters > levels[i] (hoac win): Scene cap nhat ngay.
 *     Muc tieu: moi anh cao bang nhau, chan cham dat (goc node Character). Tang dan theo level do levelScales lo.
 *  4. [Prev] / [Next] de chuyen anh nhanh. showAura de xem anh glow (hao quang max level) khop dang nguoi chua
 *     (mau lay tu AuraFx trong prefab maxLevelFx neu co).
 * Body phai dat o goc Visuals (vi tri 0, scale 1): game va cong cu deu ap scale/offset tu goc nay.
 */
@ccclass('CharacterTuner')
@executeInEditMode
export class CharacterTuner extends Component {

    @property({ type: CCInteger, tooltip: 'Nhan vat (chi so trong GameManager.characters: 0 = Mbappe, 1 = Yamal)' })
    get character(): number { return this._character; }
    set character(v: number) { this._character = Math.max(0, Math.floor(v)); this.refresh(); }

    @property({ type: TunerFrame, tooltip: 'Anh dang chinh' })
    get frame(): TunerFrame { return this._frame; }
    set frame(v: TunerFrame) { this._frame = v; this.refresh(); }

    @property({ type: TunerCompare, tooltip: 'Anh so sanh, ve mo phia sau' })
    get compare(): TunerCompare { return this._compare; }
    set compare(v: TunerCompare) { this._compare = v; this.refresh(); }

    @property({ type: CCFloat, range: [0, 1, 0.05], slide: true, tooltip: 'Do dam anh so sanh' })
    get ghostOpacity(): number { return this._ghostOpacity; }
    set ghostOpacity(v: number) { this._ghostOpacity = v; this.refresh(); }

    @property({ tooltip: 'Hien hao quang (glow) cua anh dang xem' })
    get showAura(): boolean { return this._showAura; }
    set showAura(v: boolean) { this._showAura = v; this.refresh(); }

    @property({ displayName: '[Prev]', tooltip: 'Tick de xem anh truoc' })
    get prev(): boolean { return false; }
    set prev(v: boolean) { if (v) this.step(-1); }

    @property({ displayName: '[Next]', tooltip: 'Tick de xem anh tiep theo' })
    get next(): boolean { return false; }
    set next(v: boolean) { if (v) this.step(1); }

    @property
    private _character = 0;
    @property
    private _frame = TunerFrame.Lv1;
    @property
    private _compare = TunerCompare.None;
    @property
    private _ghostOpacity = 0.4;
    @property
    private _showAura = false;

    private _ghost: Sprite | null = null;
    private _aura: Sprite | null = null;

    onEnable() {
        if (EDITOR) this.refresh();
    }

    onDisable() {
        this._ghost?.node.destroy();
        this._aura?.node.destroy();
        this._ghost = this._aura = null;
    }

    update() {
        // Chay lien tuc trong editor de sua scale/offset trong GameManager la thay ngay
        if (EDITOR) this.refresh();
    }

    private step(d: number): void {
        const n = TunerFrame.Win + 1;
        this._frame = ((this._frame + d) % n + n) % n;
        this.refresh();
    }

    private refresh(): void {
        if (!EDITOR || !this.enabledInHierarchy) return;
        const pv = this.getComponent(PlayerVisual), body = pv?.body;
        const cfg = this.config();
        if (!body || !cfg) return;
        const base = new FrameBase();
        base.pos.z = body.node.position.z;
        const f = this.pick(cfg, this._frame);
        applyFrame(body, f, base);

        const aura = this._aura = this.preview(this._aura, 'TunerAura', body, body.node.getSiblingIndex());
        aura.node.active = this._showAura && !!f?.glow;
        if (aura.node.active) {
            const ab = new FrameBase();
            ab.pos.z = body.node.position.z - 1;
            applyGlow(aura, f, body, ab);
            const c = cfg.maxLevelFx?.data?.getComponent(AuraFx)?.auraColor ?? new Color(255, 255, 255, 200);
            aura.color = new Color(c.r, c.g, c.b, c.a);
        }

        const g = this._compare === TunerCompare.None ? null : this.pick(cfg, this._compare - 1);
        const ghost = this._ghost = this.preview(this._ghost, 'TunerGhost', body, 0);
        ghost.node.active = !!g;
        if (g) {
            const gb = new FrameBase();
            gb.pos.z = body.node.position.z - 3;
            applyFrame(ghost, g, gb);
            ghost.color = new Color(255, 255, 255, Math.round(255 * this._ghostOpacity));
        }
    }

    private config(): CharacterConfig | null {
        const gm = director.getScene()?.getComponentInChildren(GameManager);
        return gm?.characters[this._character] ?? null;
    }

    private pick(cfg: CharacterConfig, frame: number): CharacterFrame | null {
        return frame === TunerFrame.Win ? cfg.win : cfg.levels[frame] ?? null;
    }

    /** Sprite xem truoc (so sanh / hao quang): khong luu vao scene, an khoi Hierarchy, anchor giong Body. */
    private preview(cur: Sprite | null, name: string, body: Sprite, index: number): Sprite {
        if (cur?.isValid) return cur;
        const n = new Node(name);
        n._objFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
        n.layer = body.node.layer;
        n.setParent(body.node.parent);
        n.setSiblingIndex(index);
        const ut = n.addComponent(UITransform), b = body.getComponent(UITransform)!;
        ut.setAnchorPoint(b.anchorX, b.anchorY);
        return n.addComponent(Sprite);
    }
}
