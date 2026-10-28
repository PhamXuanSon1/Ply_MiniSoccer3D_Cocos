import { _decorator, AudioClip, AudioSource, Node, Enum, CCFloat, CCInteger } from 'cc';
import { Ply_Singleton } from './Ply_Singleton';
const { ccclass, property } = _decorator;

/**
 * Enum cac loai hieu ung am thanh (FX).
 */
export enum FxType {
    Clock = 0,
    PlayerWin = 1,
    PlayerLoose = 2,
    RightChoice = 3,
    WrongChoice = 4,
    MaxLevel = 5,
    FightingCloud = 6,
}
Enum(FxType);

const FX_TYPE_COUNT = 7;

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
    clock: SoundData = new SoundData();

    @property(SoundData)
    playerWin: SoundData = new SoundData();

    @property(SoundData)
    playerLoose: SoundData = new SoundData();

    @property(SoundData)
    rightChoice: SoundData = new SoundData();

    @property(SoundData)
    wrongChoice: SoundData = new SoundData();

    @property(SoundData)
    maxLevel: SoundData = new SoundData();

    @property(SoundData)
    fightingCloud: SoundData = new SoundData();
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
    private queueTimers: ((() => void) | null)[] = new Array(FX_TYPE_COUNT).fill(null);
    /** Các sequence đang phát — mỗi sequence 1 AudioSource riêng nên phát chồng lên nhau được. */
    private sequences: FxSequenceRun[] = [];
    /** AudioSource rảnh để dùng lại cho sequence sau. */
    private idleSequenceSources: AudioSource[] = [];

    private isMute: boolean = false;
    private bgmWasPlaying: boolean = false;

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
        // Moi FxType chi giu 1 callback kiem tra; callback cu phai unschedule dung tham chieu
        const old = this.queueTimers[index];
        if (old) this.unschedule(old);

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

        this.queueTimers[index] = callback;
        this.schedule(callback, 0.016);
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
        // Dang mute (an tab / SDK mute luc vao game): ghi nho de unmute thi phat
        if (this.isMute) { this.bgmWasPlaying = true; return; }
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
            case FxType.Clock: return this.fxAudio.clock;
            case FxType.PlayerWin: return this.fxAudio.playerWin;
            case FxType.PlayerLoose: return this.fxAudio.playerLoose;
            case FxType.RightChoice: return this.fxAudio.rightChoice;
            case FxType.WrongChoice: return this.fxAudio.wrongChoice;
            case FxType.MaxLevel: return this.fxAudio.maxLevel;
            case FxType.FightingCloud: return this.fxAudio.fightingCloud;
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
     * Tat toan bo am thanh (BGM + FX). BGM chi tam dung (pause) de unmute phat tiep dung cho cu.
     */
    public mute() {
        if (!this.isMute) this.bgmWasPlaying = !!this.bgm1?.playing;
        this.isMute = true;
        this.stopFxSequence();
        if (this.bgm1) this.bgm1.pause();
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
        // PlayableSDK.onUnmute: BGM dang phat truoc khi mute thi phat tiep tu cho da pause
        if (this.bgmWasPlaying) this.playBGM1();
        this.bgmWasPlaying = false;
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
        this.bgmWasPlaying = false;
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
