import { _decorator, AudioClip, AudioSource, Node, Enum, CCFloat, CCInteger } from 'cc';
import { Ply_Singleton } from './Ply_Singleton';
const { ccclass, property } = _decorator;

/**
 * Enum cac loai hieu ung am thanh (FX).
 */
export enum FxType {
    ClickBox = 0,
    PickItem = 1,
    HeavyWood = 2,
    SmallWood = 3,
    Cloth = 4,
    dropMetal = 5,
    Glass = 6,
    dropOnFloor = 7,
    cat1 = 8,
    cat2 = 9,
    cat3 = 10,
    water = 11,
    burnOn = 12,
    bookOpen = 13,
    CapyDrop = 14,
    Grass = 15,
    Chair = 16,
    CoinBag = 17,
    GoldChest = 18,
    WoodenFish = 19,
    Window = 20,
    WoodenDoor = 21,
    Skeleton = 22,
    WoodenChair = 23,
    ComCop = 24,
    Rem = 25,
    ClothesDrop = 26,
    Sat1 = 27,
    Sat2 = 28,
    Computer = 29,
    Rock = 30,
    Piano = 31,
    Ghost = 32,
    Pumpkin = 33,
    BroomSweep = 34,
    BoilingPot = 35,
    GhostScare = 36,
}
Enum(FxType);

const FX_TYPE_COUNT = 37;

/**
 * Cau hinh du lieu am thanh.
 * Tuong duong voi class SoundData trong Unity gom AudioClip, volume va repeatCount.
 */
@ccclass('SoundData')
class SoundData {
    @property(AudioClip)
    clip: AudioClip | null = null;

    @property({ type: CCFloat, range: [0, 1], slide: true })
    volume: number = 1;

    @property(CCInteger)
    repeatCount: number = 1;
}

/**
 * Cau hinh FX Audio - chua tat ca du lieu am thanh hieu ung.
 * Moi truong tuong ung voi mot gia tri trong enum FxType.
 */
@ccclass('FxAudio')
class FxAudio {
    @property(SoundData)
    clickBox: SoundData = new SoundData();

    @property(SoundData)
    pickItem: SoundData = new SoundData();

    @property(SoundData)
    heavyWood: SoundData = new SoundData();

    @property(SoundData)
    smallWood: SoundData = new SoundData();

    @property(SoundData)
    cloth: SoundData = new SoundData();

    @property(SoundData)
    dropMetal: SoundData = new SoundData();

    @property(SoundData)
    glass: SoundData = new SoundData();

    @property(SoundData)
    dropOnFloor: SoundData = new SoundData();

    @property(SoundData)
    cat1: SoundData = new SoundData();

    @property(SoundData)
    cat2: SoundData = new SoundData();

    @property(SoundData)
    cat3: SoundData = new SoundData();

    @property(SoundData)
    water: SoundData = new SoundData();

    @property(SoundData)
    burnOn: SoundData = new SoundData();

    @property(SoundData)
    bookOpen: SoundData = new SoundData();

    @property(SoundData)
    capyDrop: SoundData = new SoundData();

    @property(SoundData)
    grass: SoundData = new SoundData();

    @property(SoundData)
    chair: SoundData = new SoundData();

    @property(SoundData)
    coinBag: SoundData = new SoundData();

    @property(SoundData)
    goldChest: SoundData = new SoundData();

    @property(SoundData)
    woodenFish: SoundData = new SoundData();

    @property(SoundData)
    window: SoundData = new SoundData();

    @property(SoundData)
    woodenDoor: SoundData = new SoundData();

    @property(SoundData)
    skeleton: SoundData = new SoundData();

    @property(SoundData)
    woodenChair: SoundData = new SoundData();

    @property(SoundData)
    comCop: SoundData = new SoundData();

    @property(SoundData)
    rem: SoundData = new SoundData();

    @property(SoundData)
    clothesDrop: SoundData = new SoundData();

    @property(SoundData)
    sat1: SoundData = new SoundData();

    @property(SoundData)
    sat2: SoundData = new SoundData();

    @property(SoundData)
    computer: SoundData = new SoundData();

    @property(SoundData)
    rock: SoundData = new SoundData();

    @property(SoundData)
    piano: SoundData = new SoundData();

    @property(SoundData)
    ghost: SoundData = new SoundData();

    @property(SoundData)
    pumpkin: SoundData = new SoundData();

    @property(SoundData)
    broomSweep: SoundData = new SoundData();

    @property(SoundData)
    boilingPot: SoundData = new SoundData();

    @property(SoundData)
    ghostScare: SoundData = new SoundData();
}

/** 1 sequence FX dang phat (playFxSequence). */
interface FxSequenceRun {
    source: AudioSource;
    list: FxType[];
    index: number;
    callback: (() => void) | null;
}

/**
 * Quan ly am thanh duoc chuyen tu Unity Ply_SoundManager.
 * 
 * Cac diem khac biet chinh so voi Unity:
 * - Dung AudioSource component cua Cocos thay vi Unity AudioSource
 * - Dung schedule va callback kiem tra hang cho thay vi Coroutine
 * - Nhac nen (BGM) dung component AudioSource rieng gan qua Inspector
 * - Am thanh FX phat qua AudioSource.playOneShot() hoac play()
 */
@ccclass('Ply_SoundManager')
export class Ply_SoundManager extends Ply_Singleton {

    public static Ins: Ply_SoundManager | null = null;

    @property(FxAudio)
    fxAudio: FxAudio = new FxAudio();

    @property(AudioSource)
    bgm1: AudioSource | null = null;

    private fxSources: (AudioSource | null)[] = new Array(FX_TYPE_COUNT).fill(null);
    private queuedCount: number[] = new Array(FX_TYPE_COUNT).fill(0);
    private queueTimers: (number | null)[] = new Array(FX_TYPE_COUNT).fill(null);
    /** Các sequence đang phát — mỗi sequence 1 AudioSource riêng nên phát chồng lên nhau được. */
    private sequences: FxSequenceRun[] = [];
    /** AudioSource rảnh để dùng lại cho sequence sau. */
    private idleSequenceSources: AudioSource[] = [];

    private isMute: boolean = false;

    onLoad() {
        super.onLoad();
        Ply_SoundManager.Ins = this;
    }

    /**
     * Phat am thanh hieu ung ngay lap tuc.
     * Neu dang phat, no se phat lai tu dau.
     */
    /** Đang tắt tiếng FX (script khác tự phát AudioClip thì kiểm tra cờ này). */
    public get isMuted(): boolean {
        return this.isMute;
    }

    public playFx(fxType: FxType) {
        if (this.isMute) return;

        const data = this.getSoundData(fxType);
        if (!data || !data.clip) return;

        const index = fxType as number;
        if (!this.fxSources[index]) {
            this.fxSources[index] = this.createAudioSource(`SoundFX_${FxType[fxType]}`);
        }

        const source = this.fxSources[index]!;
        source.clip = data.clip;
        source.volume = data.volume;
        source.play();

        // Phat lap de tang am luong (giong xu ly trong Unity)
        for (let i = 1; i < data.repeatCount; i++) {
            source.playOneShot(data.clip, data.volume);
        }
    }

    /**
     * Phat cac FX theo thu tu. FX sau chi bat dau khi FX truoc da phat xong.
     * Moi lan goi chay 1 sequence rieng (AudioSource rieng) -> KHONG cat sequence dang phat
     * cua item truoc, cac sequence phat chong len nhau.
     */
    public playFxSequence(fxTypes: readonly FxType[]): void {
        if (this.isMute) return;

        const list = fxTypes.filter((fxType) => !!this.getSoundData(fxType)?.clip);
        if (list.length === 0) return;

        const run: FxSequenceRun = {
            source: this.idleSequenceSources.pop() ?? this.createAudioSource('SoundFX_Sequence'),
            list,
            index: 0,
            callback: null,
        };
        this.sequences.push(run);
        this.playNextFxInSequence(run);
    }

    private playNextFxInSequence(run: FxSequenceRun): void {
        if (this.isMute || run.index >= run.list.length) {
            this.finishSequence(run);
            return;
        }

        const data = this.getSoundData(run.list[run.index++]);
        if (!data?.clip) {
            this.playNextFxInSequence(run);
            return;
        }

        run.source.loop = false;
        run.source.clip = data.clip;
        run.source.volume = data.volume;
        run.source.play();

        const callback = () => {
            if (!run.source.playing) {
                this.unschedule(callback);
                run.callback = null;
                this.playNextFxInSequence(run);
            }
        };
        run.callback = callback;
        this.schedule(callback, 0.016);
    }

    /** Sequence phat xong / bi dung: tra AudioSource ve pool. */
    private finishSequence(run: FxSequenceRun): void {
        if (run.callback) {
            this.unschedule(run.callback);
            run.callback = null;
        }
        run.source.stop();
        const i = this.sequences.indexOf(run);
        if (i >= 0) this.sequences.splice(i, 1);
        if (this.idleSequenceSources.indexOf(run.source) < 0) this.idleSequenceSources.push(run.source);
    }

    /** Dung TAT CA sequence FX dang phat (mute / destroy). */
    public stopFxSequence(): void {
        for (const run of this.sequences.slice()) this.finishSequence(run);
    }

    /**
     * Phat am thanh hieu ung theo hang cho.
     * Neu dang phat, dua toi da 1 lan vao hang cho.
     * Neu ang ranh, phat ngay va bat dau kiem tra hang cho.
     */
    public playFxQueued(fxType: FxType) {
        if (this.isMute) return;

        const data = this.getSoundData(fxType);
        if (!data || !data.clip) return;

        const index = fxType as number;
        if (!this.fxSources[index]) {
            this.fxSources[index] = this.createAudioSource(`SoundFX_Queued_${FxType[fxType]}`);
        }

        const source = this.fxSources[index]!;
        source.clip = data.clip;
        source.volume = data.volume;

        if (source.playing) {
            // Neu đang phat, chi cho vao hang cho toi da 1 lan
            this.queuedCount[index] = 1;
        } else {
            // Neu ranh thi phat luon
            source.play();

            // Bat dau qua trinh kiem tra hang cho
            this.startQueueCheck(index);
        }
    }

    /**
     * Kiem tra hang cho dinh ky va phat am thanh tiep theo.
     * Thay the cho CheckQueueRoutine dung Coroutine trong Unity.
     */
    private startQueueCheck(index: number) {
        if (this.queueTimers[index] !== null) {
            this.unschedule(this.checkQueueCallback.bind(this, index));
        }

        const callback = () => {
            const source = this.fxSources[index];
            if (!source) {
                this.unschedule(callback);
                this.queueTimers[index] = null;
                return;
            }

            if (!source.playing) {
                if (this.queuedCount[index] > 0) {
                    this.queuedCount[index] = 0;
                    source.play();
                } else {
                    this.unschedule(callback);
                    this.queueTimers[index] = null;
                }
            }
        };

        this.schedule(callback, 0.016);
    }

    private checkQueueCallback(index: number) {
        // Callback giu tham chieu
    }

    /**
     * Phat am thanh hieu ung lặp lai (loop).
     */
    public playLoopFx(fxType: FxType) {
        if (this.isMute) return;

        const data = this.getSoundData(fxType);
        if (!data || !data.clip) return;

        const index = fxType as number;
        if (!this.fxSources[index]) {
            this.fxSources[index] = this.createAudioSource(`SoundFX_Loop_${FxType[fxType]}`);
        }

        const source = this.fxSources[index]!;
        source.clip = data.clip;
        source.volume = data.volume;
        source.loop = true;
        source.play();
    }

    /**
     * Dung mot am thanh hieu ung cu the.
     */
    public stopFx(fxType: FxType) {
        const index = fxType as number;
        if (index >= 0 && index < this.fxSources.length && this.fxSources[index]) {
            this.fxSources[index]!.stop();
        }
    }

    /**
     * Phat nhac nen.
     */
    public playBGM1() {
        if (this.isMute) return;
        if (this.bgm1 && !this.bgm1.playing) {
            this.bgm1.play();
        }
    }

    /**
     * Phat nhac nen (alias cho playBGM1).
     */
    public playBGM2() {
        this.playBGM1();
    }

    /**
     * Lay SoundData tuong ung voi FxType.
     */
    private getSoundData(type: FxType): SoundData | null {
        switch (type) {
            case FxType.ClickBox: return this.fxAudio.clickBox;
            case FxType.PickItem: return this.fxAudio.pickItem;
            case FxType.HeavyWood: return this.fxAudio.heavyWood;
            case FxType.SmallWood: return this.fxAudio.smallWood;
            case FxType.Cloth: return this.fxAudio.cloth;
            case FxType.dropMetal: return this.fxAudio.dropMetal;
            case FxType.Glass: return this.fxAudio.glass;
            case FxType.dropOnFloor: return this.fxAudio.dropOnFloor;
            case FxType.cat1: return this.fxAudio.cat1;
            case FxType.cat2: return this.fxAudio.cat2;
            case FxType.cat3: return this.fxAudio.cat3;
            case FxType.water: return this.fxAudio.water;
            case FxType.burnOn: return this.fxAudio.burnOn;
            case FxType.bookOpen: return this.fxAudio.bookOpen;
            case FxType.CapyDrop: return this.fxAudio.capyDrop;
            case FxType.Grass: return this.fxAudio.grass;
            case FxType.Chair: return this.fxAudio.chair;
            case FxType.CoinBag: return this.fxAudio.coinBag;
            case FxType.GoldChest: return this.fxAudio.goldChest;
            case FxType.WoodenFish: return this.fxAudio.woodenFish;
            case FxType.Window: return this.fxAudio.window;
            case FxType.WoodenDoor: return this.fxAudio.woodenDoor;
            case FxType.Skeleton: return this.fxAudio.skeleton;
            case FxType.WoodenChair: return this.fxAudio.woodenChair;
            case FxType.ComCop: return this.fxAudio.comCop;
            case FxType.Rem: return this.fxAudio.rem;
            case FxType.ClothesDrop: return this.fxAudio.clothesDrop;
            case FxType.Sat1: return this.fxAudio.sat1;
            case FxType.Sat2: return this.fxAudio.sat2;
            case FxType.Computer: return this.fxAudio.computer;
            case FxType.Rock: return this.fxAudio.rock;
            case FxType.Piano: return this.fxAudio.piano;
            case FxType.Ghost: return this.fxAudio.ghost;
            case FxType.Pumpkin: return this.fxAudio.pumpkin;
            case FxType.BroomSweep: return this.fxAudio.broomSweep;
            case FxType.BoilingPot: return this.fxAudio.boilingPot;
            case FxType.GhostScare: return this.fxAudio.ghostScare;
            default: return null;
        }
    }

    /**
     * Tat tieng chi rieng cac am thanh FX.
     */
    public muteFx() {
        this.isMute = true;
        this.stopFxSequence();
        for (let i = 0; i < this.fxSources.length; i++) {
            if (this.fxSources[i]) {
                this.fxSources[i]!.stop();
            }
        }
    }

    /**
     * Tat toan bo am thanh (BGM + FX).
     */
    public mute() {
        this.isMute = true;
        this.stopFxSequence();
        if (this.bgm1) this.bgm1.stop();
        for (let i = 0; i < this.fxSources.length; i++) {
            if (this.fxSources[i]) {
                this.fxSources[i]!.stop();
            }
        }
    }

    /**
     * Bat lai am thanh.
     */
    public unmute() {
        this.isMute = false;
    }

    /**
     * Dung toan bo am thanh (alias cho mute).
     */
    public stopAll(): void {
        this.mute();
    }

    /**
     * Phat nhac nen.
     */
    public playBGM(): void {
        this.playBGM1();
    }

    /**
     * Dung nhac nen.
     */
    public stopBGM(): void {
        if (this.bgm1) {
            this.bgm1.stop();
        }
    }

    /**
     * Phat am thanh theo FxType (alias cho playFx).
     */
    public playSound(fxType: FxType): void {
        this.playFx(fxType);
    }

    /**
     * Tao mot AudioSource component moi tren node con.
     */
    private createAudioSource(name: string): AudioSource {
        const audioNode = new Node(name);
        audioNode.setParent(this.node);
        return audioNode.addComponent(AudioSource);
    }

    onDestroy() {
        this.stopFxSequence();
        super.onDestroy();
        if (Ply_SoundManager.Ins === this) {
            Ply_SoundManager.Ins = null;
        }
    }
}
