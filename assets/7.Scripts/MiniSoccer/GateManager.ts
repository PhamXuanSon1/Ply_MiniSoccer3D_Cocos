import { _decorator, CCBoolean, CCFloat, CCInteger, Color, Component, instantiate, Node, Prefab, Sprite, SpriteFrame, tween, UITransform, Vec3 } from 'cc';
import { EDITOR } from 'cc/env';
import { CharacterConfig, ChoiceType, GameEvent, gameEvents, GameManager } from './GameManager';
import { PlayerController } from './PlayerController';
const { ccclass, property } = _decorator;

/** Hinh + vien cua 1 loai bang (Increase/Decrease). */
@ccclass('GateChoiceStyle')
export class GateChoiceStyle {
    @property(SpriteFrame)
    visual: SpriteFrame | null = null;

    @property({ type: CCFloat, tooltip: 'Scale cua node Visual (anh to nho khac nhau)' })
    visualScale = 1;

    @property(SpriteFrame)
    border: SpriteFrame | null = null;
}

/**
 * Quan ly 5 cong chon (gop ChoiceBoardPlacer + ChoiceBoardHolder + ChoiceBoard ben Unity).
 * - Trong editor: bam [Build Gates] de sinh cong tu prefab Gate, dat cach deu; chinh tay tung cong sau do neu muon.
 * - Khi choi: dung dung cac cong dang co trong node nay (khong sinh them), kiem tra cau thu qua cong theo truc z.
 * Prefab Gate: Board_L / Board_R, moi bang co con Border (vien, ve truoc) + Visual (hinh). Loai bang suy ra tu vien
 * (item tren cong doi theo nhan vat da chon, vd qua bong la cong do voi Mbappe nhung cong xanh voi Yamal).
 * Sprite cong dung 2D_NoDepthWrite: vien mo dan khong che mat cong phia sau; node Gate xep xa -> gan de ve dung thu tu.
 */
@ccclass('GateManager')
export class GateManager extends Component {

    @property({ type: Prefab, group: { name: 'Build' } })
    gatePrefab: Prefab | null = null;

    @property({ type: CCInteger, group: { name: 'Build' } })
    gateCount = 5;

    @property({ type: CCFloat, group: { name: 'Build' }, tooltip: 'z bat dau (Unity -0.049 -> Cocos 0.049)' })
    startZ = 0.049;

    @property({ type: CCFloat, group: { name: 'Build' }, tooltip: 'z ket thuc (EndPos)' })
    endZ = -36.4;

    @property({ type: CCFloat, group: { name: 'Build' } })
    gateY = -0.25;

    @property({ type: CCBoolean, group: { name: 'Build' }, tooltip: 'Dao ngau nhien trai/phai khi Build' })
    shuffleSides = true;

    @property({ type: GateChoiceStyle, group: { name: 'Style' } })
    increase = new GateChoiceStyle();

    @property({ type: GateChoiceStyle, group: { name: 'Style' } })
    decrease = new GateChoiceStyle();

    @property({ group: { name: 'Build' }, displayName: '[Build Gates]', tooltip: 'Tick de xoa cong cu va sinh lai tu prefab' })
    get buildGates(): boolean { return false; }
    set buildGates(v: boolean) { if (EDITOR && v) this.build(); }

    @property({ group: { name: 'Build' }, displayName: '[Shuffle Sides]', tooltip: 'Tick de random lai trai/phai cua cac cong dang co (khong sinh lai cong)' })
    get shuffleGates(): boolean { return false; }
    set shuffleGates(v: boolean) { if (EDITOR && v) this.shuffle(); }

    @property({ group: { name: 'Build' }, displayName: '[Clear Gates]', tooltip: 'Tick de xoa het cong' })
    get clearGates(): boolean { return false; }
    set clearGates(v: boolean) { if (EDITOR && v) this.clear(); }

    private _gates: Node[] = [];
    private _next = 0;

    onLoad() {
        gameEvents.on(GameEvent.CHARACTER_SELECTED, this.applyCharacter, this);
    }

    start() {
        // Thu tu qua cong theo z (gan -> xa), khong phu thuoc thu tu node
        this._gates = this.node.children.filter(n => n.active).sort((a, b) => b.worldPosition.z - a.worldPosition.z);
        this._next = 0;
        const character = GameManager.Ins?.character;
        if (character) this.applyCharacter(character);
    }

    onDestroy() {
        gameEvents.targetOff(this);
    }

    /** Doi item tren moi bang theo nhan vat: bang vien xanh -> increaseVisual, vien do -> decreaseVisual. */
    public applyCharacter(character: CharacterConfig): void {
        for (const gate of this.node.children) {
            for (const name of ['Board_L', 'Board_R']) {
                const board = gate.getChildByName(name);
                if (!board) continue;
                const inc = this.typeOf(board) === ChoiceType.Increase;
                this.setVisual(board, inc ? character.increaseVisual : character.decreaseVisual, inc ? character.increaseScale : character.decreaseScale);
            }
        }
    }

    update() {
        const gm = GameManager.Ins, player = PlayerController.Ins;
        if (!gm || !player || !gm.isPlaying) return;
        const z = player.virtualZ;
        // Chay theo -z: qua cong khi z cau thu <= z cong
        while (this._next < this._gates.length && z <= this._gates[this._next].worldPosition.z) {
            this.passGate(this._next, player.characterWorldX);
            this._next++;
            if (!gm.isPlaying) break;
        }
    }

    /** Loai bang theo vien: vien Increase = bang tang (hinh Visual doi theo nhan vat nen khong dung de xet). */
    public typeOf(board: Node): ChoiceType {
        const border = board.getChildByName('Border')?.getComponent(Sprite)?.spriteFrame;
        return !!border && !!this.increase.border && border.uuid === this.increase.border.uuid ? ChoiceType.Increase : ChoiceType.Decrease;
    }

    private passGate(index: number, playerX: number): void {
        const gate = this._gates[index];
        const boards = ['Board_L', 'Board_R'].map(n => gate.getChildByName(n)).filter((b): b is Node => !!b && b.active);
        if (boards.length === 0) return;
        // Bang gan cau thu nhat theo truc x (GetNearestBoard ben Unity)
        let chosen = boards[0];
        for (const b of boards) if (Math.abs(b.worldPosition.x - playerX) < Math.abs(chosen.worldPosition.x - playerX)) chosen = b;
        this.playChosen(chosen);
        this.scheduleOnce(() => { gate.active = false; }, 0.6);
        GameManager.Ins!.onGate(index, this._gates.length, this.typeOf(chosen), this.visualOf(chosen)?.spriteFrame ?? null);
    }

    /** Bang duoc chon lui ra sau 0.5 don vi, mo dan trong 0.5s roi tat (PlayChooseSequence ben Unity). */
    private playChosen(board: Node): void {
        const p = board.position;
        const back = 0.5 / Math.max(1e-6, board.parent!.worldScale.z);
        tween(board).to(0.5, { position: new Vec3(p.x, p.y, p.z - back) }).call(() => { board.active = false; }).start();
        for (const sp of board.getComponentsInChildren(Sprite)) {
            const c = sp.color;
            tween(sp).to(0.5, { color: new Color(c.r, c.g, c.b, 0) }).start();
        }
    }

    private visualOf(board: Node | null): Sprite | null {
        return board?.getChildByName('Visual')?.getComponent(Sprite) ?? null;
    }

    private applyStyle(board: Node, style: GateChoiceStyle): void {
        this.setVisual(board, style.visual, style.visualScale);
        const bsp = board.getChildByName('Border')?.getComponent(Sprite);
        if (bsp) bsp.spriteFrame = style.border;
    }

    private setVisual(board: Node, frame: SpriteFrame | null, scale: number): void {
        const visual = board.getChildByName('Visual');
        if (!visual) return;
        const sp = visual.getComponent(Sprite);
        if (sp) {
            sp.spriteFrame = frame;
            // Dat lai kich thuoc theo anh moi (RAW khong tu cap nhat khi doi anh trong editor)
            const ut = visual.getComponent(UITransform);
            if (ut && frame) ut.setContentSize(frame.originalSize);
        }
        visual.setScale(scale, scale, scale);
    }

    private clear(): void {
        for (const child of [...this.node.children]) child.destroy();
    }

    private build(): void {
        if (!this.gatePrefab) { console.warn('[GateManager] Chua gan gatePrefab'); return; }
        this.clear();
        const step = (this.endZ - this.startZ) / (this.gateCount + 1);
        for (let i = 0; i < this.gateCount; i++) {
            const gate = instantiate(this.gatePrefab);
            gate.name = 'Gate_' + (i + 1);
            gate.setParent(this.node);
            gate.setPosition(0, this.gateY, this.startZ + step * (i + 1));
            // Sprite cong khong ghi depth nen phai ve xa truoc, gan sau
            gate.setSiblingIndex(0);
            const left = gate.getChildByName('Board_L'), right = gate.getChildByName('Board_R');
            if (left) this.applyStyle(left, this.decrease);
            if (right) this.applyStyle(right, this.increase);
        }
        if (this.shuffleSides) this.shuffle();
    }

    /** Random trai/phai: doi vi tri x cua 2 bang (moi bang giu nguyen hinh, vien, kich thuoc). Luon co ca 2 kieu. */
    private shuffle(): void {
        const gates = this.node.children;
        if (gates.length === 0) return;
        const flips = gates.map(() => Math.random() < 0.5);
        if (gates.length > 1 && flips.every(f => f === flips[0])) flips[Math.floor(Math.random() * flips.length)] = !flips[0];
        gates.forEach((g, i) => { if (flips[i]) this.swapBoards(g); });
    }

    private swapBoards(gate: Node): void {
        const a = gate.getChildByName('Board_L'), b = gate.getChildByName('Board_R');
        if (!a || !b) return;
        const pa = a.position.clone(), pb = b.position;
        a.setPosition(pb.x, pa.y, pa.z);
        b.setPosition(pa.x, pb.y, pb.z);
    }
}
