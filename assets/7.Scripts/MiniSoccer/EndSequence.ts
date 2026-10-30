import { _decorator, CCFloat, Component, Node, ParticleSystem, Sprite, Tween, tween, Vec3 } from 'cc';
import { ui } from '../Manager/UI';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { applyFrame, FrameBase } from '../../CharacterFX/Scripts/CharacterFrame';
import { CharacterConfig, GameEvent, gameEvents, GameManager } from './GameManager';
import { WinShowcase } from '../../CharacterFX/Scripts/WinShowcase';
const { ccclass, property } = _decorator;

/**
 * Canh danh Boss sau cong cuoi (BossController ben Unity). Gan tren node Boss.
 * delay -> an Boss + cau thu, bat may danh nhau -> fightDuration -> hien anh ket qua (+ WinPar khi thang)
 * -> showResultDuration -> an HUD, bat endcard Win/Lose (ui.onWin/onLose, cham la vao store).
 * Thoi gian va anh ket qua lay tu GameManager. Boss = nhan vat khong duoc chon (anh level cao nhat).
 * Anh Boss / ket qua giu kich thuoc goc, ap scale/offset rieng tung anh (CharacterFrame) tren scale goc cua node.
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

    @property({ type: CCFloat, tooltip: 'Phong to anh ket qua khi thang' })
    winScale = 1.3;

    @property({ type: CCFloat, tooltip: 'Phong to anh ket qua khi thua (anh thang cua Boss)' })
    loseScale = 1.3;

    @property({ type: Node, tooltip: 'Prefab FX_Win (goc co WinShowcase): tia sang + hao quang + chop + sao + phao giay khi thang' })
    winEffect: Node | null = null;

    @property({ type: Sprite, tooltip: 'Anh chinh endcard Lose (Lose/Content/MainImg): doi thanh anh thang cua Boss' })
    loseEndcardImage: Sprite | null = null;

    @property({ type: [Node], tooltip: 'An khi bat may danh nhau (o chon tren HUD)' })
    hideOnFight: Node[] = [];

    @property({ type: [Node], tooltip: 'An khi bat endcard (HUD, cau thu...)' })
    hideOnEndcard: Node[] = [];

    private _started = false;
    private _resultBase = new FrameBase();
    private _bossBase = new FrameBase();
    private _loseBase = new FrameBase();

    onLoad() {
        this._resultBase = new FrameBase(this.result?.node);
        this._bossBase = new FrameBase(this.bossVisual);
        this._loseBase = new FrameBase(this.loseEndcardImage?.node);
        for (const n of [this.fightingCloud, this.result?.node]) if (n) n.active = false;
        gameEvents.on(GameEvent.CHARACTER_SELECTED, this.applyBoss, this);
        gameEvents.on(GameEvent.FINISHED, this.onFinished, this);
    }

    start() {
        const gm = GameManager.Ins;
        if (gm?.boss) this.applyBoss(gm.character, gm.boss);
    }

    onDestroy() {
        gameEvents.targetOff(this);
    }

    private applyBoss(_character: CharacterConfig, boss: CharacterConfig): void {
        const sp = this.bossVisual?.getComponent(Sprite);
        if (sp) applyFrame(sp, boss.boss, this._bossBase);
        if (this.loseEndcardImage) applyFrame(this.loseEndcardImage, boss.win, this._loseBase);
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
            applyFrame(this.result, isWin ? gm.resultWin : gm.resultLose, this._resultBase, isWin ? this.winScale : this.loseScale);
            const node = this.result.node;
            const target = node.scale.clone();
            node.active = true;
            // Nay vao: nho -> vuot 1.1 -> ve dung kich thuoc
            Tween.stopAllByTarget(node);
            node.setScale(Vec3.multiplyScalar(new Vec3(), target, 0.6));
            tween(node)
                .to(0.25, { scale: Vec3.multiplyScalar(new Vec3(), target, 1.1) }, { easing: 'quadOut' })
                .to(0.15, { scale: target }, { easing: 'quadIn' })
                .start();
        }
        if (isWin) {
            // Chi giu tham chieu node goc prefab (tham chieu component ben trong instance khong luu duoc khi gan bang script)
            this.winEffect?.getComponent(WinShowcase)?.play();
        }
        Ply_SoundManager.Ins?.playFx(isWin ? FxType.PlayerWin : FxType.PlayerLoose);
    }

    private showEndcard(isWin: boolean): void {
        // BGM chay tiep qua endcard (loop), khong tat nhu ban Unity
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
