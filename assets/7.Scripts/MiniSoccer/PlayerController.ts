import { _decorator, Component, Node, Vec3, view } from 'cc';
import { GameController, gc } from '../Tool/GameController';
import { GameEvent, gameEvents, GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

const _tmp = new Vec3();

/**
 * Cau thu chay theo truc z (Rig) trong totalMoveTime + keo ngang giua 2 lan; camera bam theo Rig.
 * Gan tren node Rig. Thay PlayerController (DOMove) ben Unity; moveCurve ben Unity la duong thang nen chay deu.
 */
@ccclass('PlayerController')
export class PlayerController extends Component {

    public static Ins: PlayerController | null = null;

    @property(Node)
    character: Node | null = null;

    @property(Node)
    trackLeft: Node | null = null;

    @property(Node)
    trackRight: Node | null = null;

    @property({ type: Node, tooltip: 'Diem dich (EndPos)' })
    endPos: Node | null = null;

    @property({ type: Node, tooltip: 'Camera bam theo Rig (WCam)' })
    cameraNode: Node | null = null;

    @property({ tooltip: 'Vi tri camera so voi Rig' })
    cameraOffset = new Vec3(0, 0, 1.811);

    @property({ tooltip: 'Dung som truoc EndPos bao nhieu don vi (giu nguyen toc do); 0.535 = cau thu dung ngang vach chan Boss' })
    stopBeforeEnd = 0.535;

    @property({ tooltip: 'Cocos dat Character lui truoc 0.584 de chan cham dat; z cua cau thu ben Unity = Rig.z + gia tri nay' })
    unityCharacterZ = 0.049;

    private _startZ = 0;
    private _endZ = -36.4;
    private _t = 0;
    private _targetX = 0;
    private _running = false;

    /** z cau thu theo vi tri Unity, dung de xet qua cong dung thoi diem nhu ban Unity. */
    public get virtualZ(): number { return this.node.worldPosition.z + this.unityCharacterZ; }
    public get characterWorldX(): number { return this.character ? this.character.worldPosition.x : 0; }
    /** 0..1 quang duong da chay. */
    public get progress(): number {
        const T = GameManager.Ins?.totalMoveTime ?? 13;
        return Math.min(1, this._t / T);
    }

    onLoad() {
        PlayerController.Ins = this;
        this._startZ = this.node.position.z;
        if (this.endPos) this._endZ = this.endPos.position.z;
        if (this.character) this._targetX = this.character.position.x;
        gameEvents.on(GameEvent.START, this.onStart, this);
    }

    start() {
        gc?.node.on(GameController.EVENT_STOP, this.onStop, this);
        this.followCamera();
    }

    onDestroy() {
        gameEvents.targetOff(this);
        gc?.node.off(GameController.EVENT_STOP, this.onStop, this);
        if (PlayerController.Ins === this) PlayerController.Ins = null;
    }

    /** Keo ngang tuong doi: dx tinh theo don vi UI (InputManager.dir.x). */
    public dragBy(dx: number): void {
        const gm = GameManager.Ins;
        if (!gm || !gm.isPlaying || !this.trackLeft || !this.trackRight) return;
        const minX = Math.min(this.trackLeft.position.x, this.trackRight.position.x);
        const maxX = Math.max(this.trackLeft.position.x, this.trackRight.position.x);
        const size = view.getVisibleSize();
        // Dung canh ngan de do nhay nhu nhau o man doc lan man ngang
        const fullTrack = Math.max(1, Math.min(size.width, size.height) * gm.dragScreenRatio);
        this._targetX = Math.min(maxX, Math.max(minX, this._targetX + dx / fullTrack * (maxX - minX)));
    }

    update(dt: number) {
        const gm = GameManager.Ins;
        if (!this._running || !gm) return;
        // Van chay sau cong cuoi (Ending) nhu ban Unity; toc do = quang Start->EndPos / totalMoveTime, dung som stopBeforeEnd
        if (gm.state === GameState.Playing || gm.state === GameState.Ending) {
            const T = gm.totalMoveTime;
            const dist = Math.abs(this._endZ - this._startZ);
            const stopT = T * Math.max(0, Math.min(1, (dist - this.stopBeforeEnd) / Math.max(1e-6, dist)));
            this._t = Math.min(stopT, this._t + dt);
            const p = this.node.position;
            this.node.setPosition(p.x, p.y, this._startZ + (this._endZ - this._startZ) * (this._t / T));
            if (this._t >= stopT) this._running = false;
        }
        if (this.character) {
            const c = this.character.position;
            const k = 1 - Math.exp(-gm.dragSmoothSpeed * dt);
            this.character.setPosition(c.x + (this._targetX - c.x) * k, c.y, c.z);
        }
    }

    lateUpdate() {
        this.followCamera();
    }

    private followCamera(): void {
        if (!this.cameraNode) return;
        Vec3.add(_tmp, this.node.worldPosition, this.cameraOffset);
        this.cameraNode.setWorldPosition(_tmp);
    }

    private onStart(): void {
        this._running = true;
    }

    private onStop(): void {
        this._running = false;
    }
}
