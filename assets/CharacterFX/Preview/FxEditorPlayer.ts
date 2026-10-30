import { _decorator, assetManager, CCClass, CCFloat, CCObject, Component, Enum, instantiate, js, Node, ParticleSystem, Prefab, TweenSystem } from 'cc';
import { EDITOR } from 'cc/env';
import { applyFrame, FrameBase } from '../Scripts/CharacterFrame';
import { CharacterFx } from '../Scripts/CharacterFx';
import { WinShowcase } from '../Scripts/WinShowcase';
import { FxPreviewer } from './FxPreviewer';
const { ccclass, property, executeInEditMode } = _decorator;

/** Editor: Engine trong scene process (khong co typing). */
declare const cce: any;
declare const Editor: any;

type Mode = 'character' | 'win' | 'particles';

/**
 * XEM HIEU UNG NGAY TRONG SCENE EDITOR (khong can bam Play).
 * Mo scene CharacterFX_Preview, roi chon FX o dropdown `Chon FX` (liet ke prefab trong prefabFolder),
 * hoac BAM CHON 1 prefab FX trong panel Assets -> hieu ung tu chay trong Scene view.
 * - Prefab co CharacterFx (FX_*_MaxLevel): gan len nhan vat mau, nhan vat lach qua lai; hieu ung 1 lan (Ronaldo) tu chay lai.
 * - Prefab co WinShowcase (FX_Win): hien anh thang mau + chay hieu ung, lap lai.
 * - Prefab chi co ParticleSystem (FX_FightingCloud ...): chay particle, lap lai.
 * Editor khong tu tick tween / particle / update cua script thuong -> component nay tu tick.
 * Node tao ra deu DontSave: luu scene khong dinh hieu ung.
 */
@ccclass('FxEditorPlayer')
@executeInEditMode
export class FxEditorPlayer extends Component {

    @property({ type: FxPreviewer, tooltip: 'Lay nhan vat mau / canh thang tu FxPreviewer' })
    previewer: FxPreviewer | null = null;

    @property({ tooltip: 'Bat / tat xem trong editor' })
    get playing(): boolean { return this._playing; }
    set playing(v: boolean) { this._playing = v; if (!v) this.clear(); else this._lastUuid = ''; }

    @property({ type: Enum({ '(dang tai...)': 0 }), displayName: 'Chon FX', tooltip: 'Chon hieu ung de xem (danh sach lay tu prefabFolder)' })
    get pick(): number { return this._pick; }
    set pick(v: number) {
        this._pick = v;
        const item = this._list[v];
        if (EDITOR && item) this.load(item.uuid);
    }

    @property({ tooltip: 'Thu muc chua prefab FX de liet ke vao dropdown' })
    get prefabFolder(): string { return this._prefabFolder; }
    set prefabFolder(v: string) { this._prefabFolder = v; if (EDITOR) this.refreshList(); }

    @property({ type: Prefab, visible: false })
    get effect(): Prefab | null { return this._effect; }
    set effect(v: Prefab | null) { this._effect = v; if (EDITOR) this.show(v); }

    @property({ type: CCFloat, tooltip: 'Hieu ung 1 lan (thang, may, Ronaldo) chay lai sau bao nhieu giay' })
    loop = 3;

    @property
    private _playing = true;
    @property
    private _effect: Prefab | null = null;
    @property
    private _pick = 0;
    @property
    private _prefabFolder = 'db://assets/CharacterFX/Prefabs';

    private _list: { name: string, uuid: string }[] = [];

    private _lastUuid = '';
    private _mode: Mode | null = null;
    private _spawned: Node[] = [];
    private _t = 0;
    private _phase = 0;
    private _baseX = 0;
    private _loading = false;
    private _timer: ReturnType<typeof setInterval> | null = null;
    private _pendingParticles: ParticleSystem[] = [];

    onEnable() {
        if (!EDITOR) return;
        this._lastUuid = '';
        this.refreshList();
        // Editor chi ve lai khi co thay doi -> giu 1 timer xin ve lien tuc de update() duoc goi moi khung
        this._timer = setInterval(() => { if (this._playing && this.isValid) this.repaint(); }, 16);
    }

    onDisable() {
        if (!EDITOR) return;
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
        this.clear();
    }

    update(dt: number) {
        if (!EDITOR || !this._playing) return;
        dt = Math.min(dt, 0.05);
        this.pollSelection();
        if (this._mode) this.tick(dt);
    }

    /** Asset dang chon trong panel Assets la prefab moi -> doi hieu ung. */
    private pollSelection(): void {
        if (this._loading || typeof Editor === 'undefined') return;
        let uuid = '';
        try {
            if (Editor.Selection.getLastSelectedType() !== 'asset') return;
            uuid = Editor.Selection.getLastSelected('asset') || '';
        } catch { return; }
        if (!uuid || uuid === this._lastUuid) return;
        this.load(uuid);
    }

    /** Nap prefab theo uuid; la prefab FX thi xem luon va dong bo dropdown. */
    private load(uuid: string): void {
        this._lastUuid = uuid;
        this._loading = true;
        assetManager.loadAny(uuid, (err: Error | null, asset: unknown) => {
            this._loading = false;
            if (err || !(asset instanceof Prefab) || !this.kindOf(asset)) return;
            this._effect = asset;
            const i = this._list.findIndex(it => it.uuid === uuid);
            if (i >= 0) this._pick = i;
            this.show(asset);
        });
    }

    /** Liet ke prefab trong prefabFolder lam danh sach cho dropdown `Chon FX`. */
    private async refreshList(): Promise<void> {
        if (typeof Editor === 'undefined') return;
        let infos: { name: string, uuid: string }[] = [];
        try {
            const folder = this._prefabFolder.replace(/\/+$/, '');
            infos = await Editor.Message.request('asset-db', 'query-assets', { ccType: 'cc.Prefab', pattern: folder + '/**/*' }) || [];
        } catch { return; }
        this._list = infos
            .map(i => ({ name: (i.name || '').replace(/\.prefab$/, ''), uuid: i.uuid }))
            .sort((a, b) => a.name.localeCompare(b.name));
        const enumList = this._list.length > 0
            ? this._list.map((it, i) => ({ name: it.name, value: i }))
            : [{ name: '(khong co prefab)', value: 0 }];
        CCClass.Attr.setClassAttr(FxEditorPlayer, 'pick', 'enumList', enumList);
        const cur = this._effect ? this._list.findIndex(it => it.uuid === this._effect!.uuid) : -1;
        if (cur >= 0) this._pick = cur;
        else if (this._pick >= this._list.length) this._pick = 0;
        // Bao Inspector ve lai de hien danh sach moi
        try { Editor.Message.broadcast('scene:change-node', this.node.uuid); } catch { /* bo qua */ }
    }

    private kindOf(prefab: Prefab): Mode | null {
        const root = prefab.data as Node;
        if (!root) return null;
        if (root.getComponent(CharacterFx)) return 'character';
        if (root.getComponent(WinShowcase)) return 'win';
        if (root.getComponentsInChildren(ParticleSystem).length > 0) return 'particles';
        return null;
    }

    private show(prefab: Prefab | null): void {
        this.clear();
        const pv = this.previewer, host = pv?.host;
        if (!prefab || !pv || !host) return;
        const mode = this.kindOf(prefab);
        if (!mode) return;
        this._mode = mode;
        this._t = this._phase = 0;
        const isChar = mode === 'character';
        if (pv.characterGroup) pv.characterGroup.active = isChar;
        if (pv.winStage) pv.winStage.active = !isChar;
        if (pv.caption) pv.caption.string = `${prefab.name}   (editor)`;

        if (isChar) {
            const body = host.body;
            if (body) {
                const base = new FrameBase();
                base.pos.z = body.node.position.z;
                applyFrame(body, pv.sample, base);
            }
            this._baseX = host.node.position.x;
            host.setMaxLevel(false);
            host.setFrame(pv.sample);
            host.setPrefab(prefab, (n) => this.wake(n));
            host.setMaxLevel(true);
            const fx = host.fx;
            if (fx) this.track([fx.node, ...fx.movedNodes]);
            return;
        }
        if (pv.result) {
            pv.result.node.active = mode === 'win';
            if (mode === 'win') applyFrame(pv.result, pv.sampleWin, new FrameBase(pv.result.node));
        }
        this.spawnStage(prefab);
    }

    /** Tao hieu ung thang / particle trong winStage va chay. */
    private spawnStage(prefab: Prefab): void {
        const stage = this.previewer?.winStage;
        if (!stage) return;
        for (const n of this._spawned) if (n.isValid) n.destroy();
        this._spawned.length = 0;
        const node = instantiate(prefab);
        node.setParent(stage);
        this.wake(node);
        const ws = node.getComponent(WinShowcase);
        this.track(ws?.back ? [node, ws.back] : [node]);
        ws?.play();
        // Particle vua tao chua san sang trong editor -> play o khung sau (tick)
        this._pendingParticles.push(...node.getComponentsInChildren(ParticleSystem));
    }

    private tick(dt: number): void {
        this._t += dt;
        this._phase += dt;
        const host = this.previewer?.host;
        if (this._mode === 'character' && host) {
            const p = host.node.position;
            host.node.setPosition(this._baseX + Math.sin(this._t * (this.previewer?.swingSpeed ?? 2.2)) * (this.previewer?.swing ?? 0.25), p.y, p.z);
            // Hieu ung 1 lan (clip Ronaldo) -> bat lai dinh ky
            if (this._phase >= this.loop) { this._phase = 0; host.setMaxLevel(false); host.setMaxLevel(true); this.retrack(); }
        } else if (this._phase >= this.loop && this._effect) {
            this._phase = 0;
            this.spawnStage(this._effect);
        }

        if (this._pendingParticles.length > 0) {
            for (const ps of this._pendingParticles) if (ps.isValid) ps.play();
            this._pendingParticles.length = 0;
        }

        // Tick nhung he thong editor khong tu chay (Animation editor da tu tick khi dang ve lai)
        TweenSystem.instance.ActionManager.update(dt);
        for (const root of this._spawned) {
            if (!root.isValid) continue;
            for (const c of root.getComponentsInChildren(Component)) {
                if (!c.enabledInHierarchy) continue;
                if (c instanceof ParticleSystem) { (c as any).update(dt); continue; }
                if (this.isUserScript(c)) {
                    (c as any).update?.(dt);
                    (c as any).lateUpdate?.(dt);
                }
            }
        }
    }

    /** Editor khong goi onLoad cho script thuong -> goi tay de hieu ung khoi tao (pool, ring...). */
    private wake(root: Node): void {
        root._objFlags |= CCObject.Flags.DontSave;
        for (const c of root.getComponentsInChildren(Component)) {
            if (this.isUserScript(c)) (c as any).onLoad?.();
        }
    }

    private track(nodes: Node[]): void {
        for (const n of nodes) {
            if (!n || this._spawned.includes(n)) continue;
            n._objFlags |= CCObject.Flags.DontSave;
            this._spawned.push(n);
        }
    }

    /** Node tu tao them trong luc chay (vd sprite chep Ronaldo) -> danh dau DontSave. */
    private retrack(): void {
        const fx = this.previewer?.host?.fx;
        if (fx) this.track([fx.node, ...fx.movedNodes]);
    }

    private isUserScript(c: Component): boolean {
        if (c === this) return false;
        const name = js.getClassName(c);
        return !!name && !name.startsWith('cc.') && name !== 'FxPreviewer' && name !== 'FxEditorPlayer' && name !== 'CharacterFxHost';
    }

    private clear(): void {
        const host = this.previewer?.host;
        if (this._mode === 'character' && host) {
            host.setMaxLevel(false);
            host.setPrefab(null);
            const p = host.node.position;
            host.node.setPosition(this._baseX, p.y, p.z);
        }
        for (const n of this._spawned) {
            if (!n.isValid) continue;
            for (const c of n.getComponentsInChildren(Component)) if (this.isUserScript(c)) (c as any).onDestroy?.();
            n.destroy();
        }
        this._spawned.length = 0;
        this._mode = null;
        this.repaint();
    }

    private repaint(): void {
        try { cce?.Engine?.repaintInEditMode?.(); } catch { /* ngoai editor */ }
    }
}
