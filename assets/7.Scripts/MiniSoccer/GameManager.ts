import { _decorator, CCFloat, CCInteger, Color, director, Enum, EventTarget, game, Game, SpriteFrame } from 'cc';
import { PREVIEW } from 'cc/env';
import { Ply_Singleton } from '../ScriptTemplate/Ply_Singleton';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { gc, GameController } from '../Tool/GameController';
import { CharacterFrame } from './CharacterFrame';
const { ccclass, property } = _decorator;

/** Loai bang chon: tang hoac giam 1 level (EChoiceType ben Unity). */
export enum ChoiceType {
    Increase = 0,
    Decrease = 1,
}
Enum(ChoiceType);

export enum GameState {
    Select,     // dang chon nhan vat
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
    /** (character: CharacterConfig, boss: CharacterConfig) - Vua chon nhan vat (Boss = nhan vat con lai). */
    CHARACTER_SELECTED: 'character-selected',
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
    /** () - Bam Icon/Logo mo store giua game (game van choi tiep). */
    STORE_CLICKED: 'store-clicked',
} as const;

export const gameEvents = new EventTarget();

/** Hieu ung khi cau thu dat max level. */
export enum MaxLevelFx {
    Aura = 0,   // hao quang theo dang nguoi, tho nhe (Yamal)
    Flash = 1,  // chay kieu The Flash: bong mo phia sau + tia set (Mbappe), khong hao quang
}
Enum(MaxLevelFx);

/** Bo hinh cua 1 nhan vat chon duoc (Mbappe / Yamal). Nhan vat con lai lam Boss. */
@ccclass('CharacterConfig')
export class CharacterConfig {
    @property
    name = '';

    @property({ type: [CharacterFrame], tooltip: 'Anh cau thu theo level (phan tu 0 = Lv1); anh cuoi cung lam Boss' })
    levels: CharacterFrame[] = [];

    @property({ type: CharacterFrame, tooltip: 'Anh ket qua khi nhan vat nay thang (cung dung khi no la Boss va nguoi choi thua)' })
    win = new CharacterFrame();

    @property({ type: MaxLevelFx, tooltip: 'Kieu hieu ung khi max level' })
    maxFx = MaxLevelFx.Aura;

    @property({ tooltip: 'Mau hao quang quanh nguoi khi max level (maxFx = Aura) + vong sang duoi chan' })
    auraColor = new Color(255, 200, 60, 255);

    @property({ type: [Color], tooltip: 'Mau hat nang luong bay quanh nguoi khi max level' })
    particleColors: Color[] = [];

    @property({ type: SpriteFrame, tooltip: 'Item tren cong xanh (tang level)' })
    increaseVisual: SpriteFrame | null = null;

    @property({ type: CCFloat, tooltip: 'Scale node Visual cua item cong xanh' })
    increaseScale = 1;

    @property({ type: SpriteFrame, tooltip: 'Item tren cong do (giam level)' })
    decreaseVisual: SpriteFrame | null = null;

    @property({ type: CCFloat, tooltip: 'Scale node Visual cua item cong do' })
    decreaseScale = 1;

    /** Anh theo level (1..n), ngoai khoang thi kep lai. */
    public level(level: number): CharacterFrame | null {
        return this.levels[Math.min(this.levels.length, Math.max(1, level)) - 1] ?? null;
    }

    /** Anh Boss = level cao nhat. */
    public get boss(): CharacterFrame | null {
        return this.levels[this.levels.length - 1] ?? null;
    }
}

/**
 * Luat choi + thoi gian + trang thai game o 1 cho. Chi GameManager quyet dinh level va thang/thua.
 * Gia tri mac dinh lay tu scene Unity (tru maxLevel/winLevel/totalMoveTime da chinh cho ban ply25).
 */
@ccclass('GameManager')
export class GameManager extends Ply_Singleton {

    public static Ins: GameManager | null = null;

    // ---- Rules ----
    @property({ type: CCInteger, group: { name: 'Rules' }, tooltip: 'Level toi da (so anh Ronaldo_Lv)' })
    maxLevel = 4;

    @property({ type: CCInteger, group: { name: 'Rules' }, tooltip: 'Level can dat sau cong cuoi de thang (= maxLevel: phai max moi thang)' })
    winLevel = 4;

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

    // ---- Characters ----
    @property({ type: [CharacterConfig], group: { name: 'Characters' }, tooltip: '2 nhan vat chon duoc; nhan vat khong chon lam Boss' })
    characters: CharacterConfig[] = [];

    private _state = GameState.Select;
    private _level = 1;
    private _character = 0;

    public get state(): GameState { return this._state; }
    /** Nhan vat dang choi (truoc khi chon = nhan vat 0, de hien san sau panel chon). */
    public get character(): CharacterConfig { return this.characters[this._character]; }
    public get boss(): CharacterConfig { return this.characters[1 - this._character]; }
    public get resultWin(): CharacterFrame | null { return this.character?.win ?? null; }
    /** Thua thi hien anh thang cua Boss. */
    public get resultLose(): CharacterFrame | null { return this.boss?.win ?? null; }
    public get level(): number { return this._level; }
    public get isPlaying(): boolean { return this._state === GameState.Playing; }
    /** Con keo ngang duoc: dang chay qua cong hoac da qua cong cuoi nhung chua hien endcard. */
    public get canControl(): boolean { return this._state === GameState.Playing || this._state === GameState.Ending; }

    onLoad() {
        super.onLoad();
        GameManager.Ins = this;
    }

    start() {
        gc?.node.on(GameController.EVENT_STOP, this.onStop, this);
        if (typeof PlayableSDK !== 'undefined' && PlayableSDK) {
            PlayableSDK.onPause(() => director.pause());
            PlayableSDK.onResume(() => director.resume());
            PlayableSDK.onMute(() => Ply_SoundManager.Ins?.mute());
            PlayableSDK.onUnmute(() => this.onShow());
        }
        // An tab / khoa man hinh thi tat tieng, quay lai thi bat lai (neu chua sang store)
        game.on(Game.EVENT_HIDE, this.onHide, this);
        game.on(Game.EVENT_SHOW, this.onShow, this);
    }

    onDestroy() {
        gc?.node.off(GameController.EVENT_STOP, this.onStop, this);
        game.off(Game.EVENT_HIDE, this.onHide, this);
        game.off(Game.EVENT_SHOW, this.onShow, this);
        super.onDestroy();
        if (GameManager.Ins === this) GameManager.Ins = null;
    }

    /** Bam the nhan vat tren panel chon: ap hinh cho cau thu / cong / Boss, cho cham de bat dau (nhu v25). */
    public selectCharacter(index: number): void {
        if (this._state !== GameState.Select || !this.characters[index]) return;
        this._character = index;
        this._state = GameState.Ready;
        gameEvents.emit(GameEvent.CHARACTER_SELECTED, this.character, this.boss);
    }

    /** Cham lan dau (sau khi da chon nhan vat). Goi nhieu lan cung chi bat dau 1 lan. */
    public startGame(): void {
        if (this._state !== GameState.Ready) return;
        this._state = GameState.Playing;
        // BGM chi phat sau lan cham dau (playBgmOnFirstClick ben Unity)
        Ply_SoundManager.Ins?.playBGM();
        gameEvents.emit(GameEvent.START);
    }

    /** GateManager goi khi cau thu vua qua cong thu index (0..total-1). */
    public onGate(index: number, total: number, type: ChoiceType, visual: SpriteFrame | null): void {
        if (this._state !== GameState.Playing) return;
        const delta = type === ChoiceType.Increase ? 1 : -1;
        const prev = this._level;
        this._level = Math.min(this.maxLevel, Math.max(1, prev + delta));

        // Luon phat tieng dung/sai; vua len max level thi phat them MaxLevel (neu da gan clip)
        const sm = Ply_SoundManager.Ins;
        sm?.playFx(delta > 0 ? FxType.RightChoice : FxType.WrongChoice);
        if (this._level >= this.maxLevel && prev < this.maxLevel) sm?.playFx(FxType.MaxLevel);

        if (this._level !== prev) gameEvents.emit(GameEvent.LEVEL_CHANGED, this._level, delta);
        gameEvents.emit(GameEvent.GATE_PASSED, index, total, type, visual);

        if (index >= total - 1) this.finish(this._level >= this.winLevel);
    }

    /**
     * Icon / Logo tren HUD: mo store nhung KHONG dung game, quay lai van choi tiep.
     * (Cham endcard van di qua gc.redirectToStore -> dung game.) Gan vao Button click event.
     */
    public openStoreKeepPlaying(): void {
        if (PREVIEW && typeof window !== 'undefined' && !window.confirm(gc?.storeDialogMessage ?? 'Open Store')) return;
        gameEvents.emit(GameEvent.STORE_CLICKED);
        try {
            PlayableSDK.download();
        } catch (e) {
        }
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
        Ply_SoundManager.Ins?.mute();
    }

    private onHide(): void {
        Ply_SoundManager.Ins?.mute();
    }

    private onShow(): void {
        if (!gc?.stopped) Ply_SoundManager.Ins?.unmute();
    }
}
