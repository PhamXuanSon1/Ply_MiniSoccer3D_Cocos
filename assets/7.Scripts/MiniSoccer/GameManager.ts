import { _decorator, CCFloat, CCInteger, director, Enum, EventTarget, SpriteFrame } from 'cc';
import { Ply_Singleton } from '../ScriptTemplate/Ply_Singleton';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { gc, GameController } from '../Tool/GameController';
const { ccclass, property } = _decorator;

/** Loai bang chon: tang hoac giam 1 level (EChoiceType ben Unity). */
export enum ChoiceType {
    Increase = 0,
    Decrease = 1,
}
Enum(ChoiceType);

export enum GameState {
    Ready,      // cho cham lan dau
    Playing,    // dang chay qua cac cong
    Ending,     // da chot ket qua o cong cuoi, dang dien canh danh Boss
    Ended,      // da hien endcard / da sang store
}

/**
 * Event gameplay. Chi GameManager emit; script khac on() va goi gameEvents.targetOff(this) trong onDestroy.
 * Thay cho cac static Action rai rac ben Unity (GameManager.OnGameStart, UIManager.OnCharacterChoose...).
 */
export const GameEvent = {
    /** () - Cham lan dau, cau thu bat dau chay. */
    START: 'game-start',
    /** (index: number, total: number, type: ChoiceType, visual: SpriteFrame | null) - Vua qua cong thu index. */
    GATE_PASSED: 'gate-passed',
    /** (level: number, delta: number) - Level doi sau khi qua cong. */
    LEVEL_CHANGED: 'level-changed',
    /** (isWin: boolean) - Ket qua da chot (1 lan, o cong cuoi). */
    FINISHED: 'game-finished',
    /** () - Panel Win/Lose da hien. */
    ENDCARD_SHOWN: 'endcard-shown',
} as const;

export const gameEvents = new EventTarget();

/**
 * Luat choi + thoi gian + trang thai game o 1 cho. Chi GameManager quyet dinh level va thang/thua.
 * Gia tri mac dinh lay tu scene Unity (tru maxLevel/winLevel/totalMoveTime da chinh cho ban ply25).
 */
@ccclass('GameManager')
export class GameManager extends Ply_Singleton {

    public static Ins: GameManager | null = null;

    // ---- Rules ----
    @property({ type: CCInteger, group: { name: 'Rules' }, tooltip: 'Level toi da (so anh Ronaldo_Lv)' })
    maxLevel = 5;

    @property({ type: CCInteger, group: { name: 'Rules' }, tooltip: 'Level can dat sau cong cuoi de thang' })
    winLevel = 3;

    @property({ type: CCFloat, group: { name: 'Rules' }, tooltip: 'Thoi gian chay tu Start toi End (giay)' })
    totalMoveTime = 13;

    // ---- Control ----
    @property({ type: CCFloat, group: { name: 'Control' }, tooltip: 'Do bam theo ngon tay (cang lon cang sat)' })
    dragSmoothSpeed = 20;

    @property({ type: CCFloat, group: { name: 'Control' }, tooltip: 'Ti le canh ngan man hinh can vuot de di het be ngang 2 lan' })
    dragScreenRatio = 0.5;

    // ---- End sequence ----
    @property({ type: CCFloat, group: { name: 'End' }, tooltip: 'Cho sau cong cuoi truoc khi danh Boss (thang)' })
    delayWin = 1.5;

    @property({ type: CCFloat, group: { name: 'End' }, tooltip: 'Cho sau cong cuoi truoc khi danh Boss (thua)' })
    delayLose = 1;

    @property({ type: CCFloat, group: { name: 'End' }, tooltip: 'Thoi gian hien may danh nhau' })
    fightDuration = 2;

    @property({ type: CCFloat, group: { name: 'End' }, tooltip: 'Thoi gian hien ket qua truoc khi bat endcard' })
    showResultDuration = 3.5;

    @property({ type: CCFloat, group: { name: 'End' }, tooltip: 'Cho sau khi hien endcard moi cho cham mo store' })
    ctaDelay = 0.2;

    // ---- Sprites ----
    @property({ type: [SpriteFrame], group: { name: 'Sprites' }, tooltip: 'Anh cau thu theo level (phan tu 0 = Lv1)' })
    levelSprites: SpriteFrame[] = [];

    @property({ type: SpriteFrame, group: { name: 'Sprites' } })
    resultWin: SpriteFrame | null = null;

    @property({ type: SpriteFrame, group: { name: 'Sprites' } })
    resultLose: SpriteFrame | null = null;

    private _state = GameState.Ready;
    private _level = 1;

    public get state(): GameState { return this._state; }
    public get level(): number { return this._level; }
    public get isPlaying(): boolean { return this._state === GameState.Playing; }

    onLoad() {
        super.onLoad();
        GameManager.Ins = this;
    }

    start() {
        gc?.node.on(GameController.EVENT_STOP, this.onStop, this);
        if (typeof PlayableSDK !== 'undefined' && PlayableSDK) {
            PlayableSDK.onPause(() => director.pause());
            PlayableSDK.onResume(() => director.resume());
        }
    }

    onDestroy() {
        gc?.node.off(GameController.EVENT_STOP, this.onStop, this);
        super.onDestroy();
        if (GameManager.Ins === this) GameManager.Ins = null;
    }

    /** Cham lan dau. Goi nhieu lan cung chi bat dau 1 lan. */
    public startGame(): void {
        if (this._state !== GameState.Ready) return;
        this._state = GameState.Playing;
        gameEvents.emit(GameEvent.START);
    }

    /** GateManager goi khi cau thu vua qua cong thu index (0..total-1). */
    public onGate(index: number, total: number, type: ChoiceType, visual: SpriteFrame | null): void {
        if (this._state !== GameState.Playing) return;
        const delta = type === ChoiceType.Increase ? 1 : -1;
        const prev = this._level;
        this._level = Math.min(this.maxLevel, Math.max(1, prev + delta));

        // Am thanh phat dung 1 lan (ban Unity phat 2 lan: o ChoiceBoardHolder va UpgradePlayer)
        const fx = this._level >= this.maxLevel && prev < this.maxLevel ? FxType.MaxLevel
            : delta > 0 ? FxType.RightChoice : FxType.WrongChoice;
        Ply_SoundManager.Ins?.playFx(fx);

        if (this._level !== prev) gameEvents.emit(GameEvent.LEVEL_CHANGED, this._level, delta);
        gameEvents.emit(GameEvent.GATE_PASSED, index, total, type, visual);

        if (index >= total - 1) this.finish(this._level >= this.winLevel);
    }

    /** EndSequence goi khi da hien endcard. */
    public endcardShown(): void {
        if (this._state === GameState.Ended) return;
        this._state = GameState.Ended;
        gameEvents.emit(GameEvent.ENDCARD_SHOWN);
    }

    private finish(isWin: boolean): void {
        this._state = GameState.Ending;
        gameEvents.emit(GameEvent.FINISHED, isWin);
    }

    private onStop(): void {
        this._state = GameState.Ended;
    }
}
