import { _decorator, CCFloat, Component, Node, ParticleSystem, Sprite, Vec3 } from 'cc';
import { ui } from '../Manager/UI';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { GameEvent, gameEvents, GameManager } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Canh danh Boss sau cong cuoi (BossController ben Unity). Gan tren node Boss.
 * delay -> an Boss + cau thu, bat may danh nhau -> fightDuration -> hien anh ket qua (+ WinPar khi thang)
 * -> showResultDuration -> tat BGM, an HUD, bat endcard Win/Lose (ui.onWin/onLose, cham la vao store).
 * Thoi gian va anh ket qua lay tu GameManager.
 */
@ccclass('EndSequence')
export class EndSequence extends Component {

    @property(Node)
    bossVisual: Node | null = null;

    @property({ type: Node, tooltip: 'Hinh cau thu (Character/Visuals)' })
    characterVisual: Node | null = null;

    @property(Node)
    fightingCloud: Node | null = null;

    @property({ type: Sprite, tooltip: 'Sprite hien anh ket qua (WInPlayer)' })
    result: Sprite | null = null;

    @property({ type: CCFloat, tooltip: 'Phong to anh ket qua khi thua (Messi dung nho hon anh Ronaldo ngai vang)' })
    loseScale = 1.3;

    @property({ type: Node, tooltip: 'Bat cung anh ket qua khi thang (WinPar)' })
    winFx: Node | null = null;

    @property({ type: [Node], tooltip: 'An khi bat may danh nhau (o chon tren HUD)' })
    hideOnFight: Node[] = [];

    @property({ type: [Node], tooltip: 'An khi bat endcard (HUD, cau thu...)' })
    hideOnEndcard: Node[] = [];

    private _started = false;
    private _resultScale = new Vec3();

    onLoad() {
        if (this.result) this._resultScale.set(this.result.node.scale);
        for (const n of [this.fightingCloud, this.result?.node, this.winFx]) if (n) n.active = false;
        gameEvents.on(GameEvent.FINISHED, this.onFinished, this);
    }

    onDestroy() {
        gameEvents.targetOff(this);
    }

    private onFinished(isWin: boolean): void {
        if (this._started) return;
        this._started = true;
        const gm = GameManager.Ins!;
        const delay = isWin ? gm.delayWin : gm.delayLose;
        this.scheduleOnce(() => this.fight(), delay);
        this.scheduleOnce(() => this.showResult(isWin), delay + gm.fightDuration);
        this.scheduleOnce(() => this.showEndcard(isWin), delay + gm.fightDuration + gm.showResultDuration);
    }

    private fight(): void {
        if (this.bossVisual) this.bossVisual.active = false;
        if (this.characterVisual) this.characterVisual.active = false;
        for (const n of this.hideOnFight) n.active = false;
        this.play(this.fightingCloud);
        Ply_SoundManager.Ins?.playFx(FxType.FightingCloud);
    }

    private showResult(isWin: boolean): void {
        const gm = GameManager.Ins!;
        if (this.fightingCloud) this.fightingCloud.active = false;
        if (this.result) {
            this.result.spriteFrame = isWin ? gm.resultWin : gm.resultLose;
            const k = isWin ? 1 : this.loseScale;
            this.result.node.setScale(this._resultScale.x * k, this._resultScale.y * k, this._resultScale.z * k);
            this.result.node.active = true;
        }
        if (isWin) this.play(this.winFx);
        Ply_SoundManager.Ins?.playFx(isWin ? FxType.PlayerWin : FxType.PlayerLoose);
    }

    private showEndcard(isWin: boolean): void {
        Ply_SoundManager.Ins?.stopBGM();
        for (const n of this.hideOnEndcard) n.active = false;
        if (isWin) ui?.onWin(); else ui?.onLose();
        GameManager.Ins?.endcardShown();
    }

    /** Bat node va chay moi ParticleSystem ben trong (playOnAwake dang tat). */
    private play(node: Node | null): void {
        if (!node) return;
        node.active = true;
        for (const ps of node.getComponentsInChildren(ParticleSystem)) ps.play();
    }
}
