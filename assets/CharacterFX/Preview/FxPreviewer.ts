import { _decorator, CCFloat, Component, input, Input, instantiate, Label, Node, ParticleSystem, Prefab, Sprite } from 'cc';
import { applyFrame, CharacterFrame, FrameBase } from '../Scripts/CharacterFrame';
import { CharacterFxHost } from '../Scripts/CharacterFxHost';
import { WinShowcase } from '../Scripts/WinShowcase';
const { ccclass, property } = _decorator;

/**
 * Scene xem thu hieu ung (CharacterFX_Preview): mo scene, bam Play.
 * Lan luot chay tung prefab trong characterFx (nhan vat lach qua lai de thay duoi bong mo), roi FX_Win, roi FX_FightingCloud.
 * Tu chuyen sau `duration` giay; cham / click man hinh de chuyen ngay. Them prefab moi: keo vao characterFx.
 */
@ccclass('FxPreviewer')
export class FxPreviewer extends Component {

    @property({ type: CharacterFxHost, tooltip: 'Host tren node Character' })
    host: CharacterFxHost | null = null;

    @property({ type: [Prefab], tooltip: 'Cac prefab hieu ung max level can xem' })
    characterFx: Prefab[] = [];

    @property({ type: CharacterFrame, tooltip: 'Anh nhan vat mau (+ glow cho hao quang)' })
    sample = new CharacterFrame();

    @property({ type: CharacterFrame, tooltip: 'Anh ket qua mau cho canh thang' })
    sampleWin = new CharacterFrame();

    @property({ type: Node, tooltip: 'Nhom nhan vat (an khi xem hieu ung thang)' })
    characterGroup: Node | null = null;

    @property({ type: Node, tooltip: 'Nhom canh thang: chua sprite anh ket qua; FX_Win / FX_FightingCloud duoc tao trong nay' })
    winStage: Node | null = null;

    @property({ type: Sprite, tooltip: 'Sprite anh ket qua trong winStage' })
    result: Sprite | null = null;

    @property(Prefab)
    winPrefab: Prefab | null = null;

    @property(Prefab)
    fightPrefab: Prefab | null = null;

    @property(Label)
    caption: Label | null = null;

    @property({ type: CCFloat, tooltip: 'Moi hieu ung xem bao lau (giay) truoc khi tu chuyen' })
    duration = 4;

    @property({ type: CCFloat, tooltip: 'Nhan vat lach ngang bao xa (don vi world)' })
    swing = 0.3;

    @property({ type: CCFloat, tooltip: 'Toc do lach ngang' })
    swingSpeed = 2.2;

    private _step = -1;
    private _t = 0;
    private _baseX = 0;
    private _spawned: Node[] = [];
    private _resultBase = new FrameBase();

    start() {
        this._resultBase = new FrameBase(this.result?.node);
        const body = this.host?.body;
        if (body) {
            const base = new FrameBase();
            base.pos.z = body.node.position.z;
            applyFrame(body, this.sample, base);
        }
        this.host?.setFrame(this.sample);
        this._baseX = this.host?.node.position.x ?? 0;
        input.on(Input.EventType.TOUCH_END, this.next, this);
        this.next();
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_END, this.next, this);
    }

    update(dt: number) {
        this._t += dt;
        const host = this.host;
        if (host && this._step < this.characterFx.length) {
            const p = host.node.position;
            host.node.setPosition(this._baseX + Math.sin(this._t * this.swingSpeed) * this.swing, p.y, p.z);
        }
        if (this._t >= this.duration) this.next();
    }

    private get stepCount(): number {
        return this.characterFx.length + 2;
    }

    private next(): void {
        this._t = 0;
        this._step = (this._step + 1) % this.stepCount;
        for (const s of this._spawned) if (s.isValid) s.destroy();
        this._spawned.length = 0;
        const host = this.host, n = this.characterFx.length;

        if (this._step < n) {
            if (this.characterGroup) this.characterGroup.active = true;
            if (this.winStage) this.winStage.active = false;
            const prefab = this.characterFx[this._step];
            host?.setMaxLevel(false);
            host?.setPrefab(prefab);
            host?.setMaxLevel(true);
            this.setCaption(prefab?.name ?? '(trong)');
            return;
        }

        host?.setMaxLevel(false);
        if (this.characterGroup) this.characterGroup.active = false;
        if (this.winStage) this.winStage.active = true;
        const isWin = this._step === n;
        if (this.result) {
            this.result.node.active = isWin;
            if (isWin) applyFrame(this.result, this.sampleWin, this._resultBase);
        }
        const prefab = isWin ? this.winPrefab : this.fightPrefab;
        this.setCaption(prefab?.name ?? '(trong)');
        if (!prefab || !this.winStage) return;
        const node = instantiate(prefab);
        node.setParent(this.winStage);
        this._spawned.push(node);
        node.active = true;
        if (isWin) {
            const ws = node.getComponent(WinShowcase);
            // Nhom back da duoc WinShowcase dua ra ngoai goc prefab -> tu huy khi chuyen buoc
            if (ws?.back) this._spawned.push(ws.back);
            ws?.play();
        } else {
            for (const ps of node.getComponentsInChildren(ParticleSystem)) ps.play();
        }
    }

    private setCaption(text: string): void {
        if (this.caption) this.caption.string = `${text}   (${this._step + 1}/${this.stepCount} - cham de doi)`;
    }
}
