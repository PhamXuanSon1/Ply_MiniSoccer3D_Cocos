import { _decorator, Camera, CCFloat, Component, Node, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Panel chon nhan vat luc vao game. Gan tren node CharacterSelect (con cua UI, scale 1 = don vi world cua UICam).
 * Cham the thu i -> GameManager.selectCharacter(i) (ap hinh cau thu / cong / Boss) -> an panel, hien lai tutorial;
 * cham tiep vao man hinh moi bat dau chay (InputManager -> startGame).
 * Nen toi (Dim) gian phu kin man hinh; Content tu scale vua khung nhin (doc lan ngang).
 */
@ccclass('CharacterSelect')
export class CharacterSelect extends Component {

    @property(Camera)
    uiCamera: Camera | null = null;

    @property({ type: UITransform, tooltip: 'Sprite nen toi, gian phu kin man hinh' })
    dim: UITransform | null = null;

    @property({ type: Node, tooltip: 'Chua tieu de + cac the, duoc scale vua man hinh' })
    content: Node | null = null;

    @property({ type: [Node], tooltip: 'The chon theo thu tu GameManager.characters' })
    cards: Node[] = [];

    @property({ type: Node, tooltip: 'Tay chi, nhay qua lai giua cac the' })
    hand: Node | null = null;

    @property({ type: [Node], tooltip: 'An khi dang chon, bat lai sau khi chon (HUD...)' })
    hideWhileSelecting: Node[] = [];

    @property({ tooltip: 'Kich thuoc khung Content (don vi local cua Content)' })
    designWidth = 900;

    @property
    designHeight = 1300;

    @property({ type: CCFloat, tooltip: 'Phan man hinh toi da Content duoc chiem' })
    fitRatio = 0.92;

    private _chosen = false;
    private _halfW = 0;
    private _halfH = 0;
    private _cardScales: Vec3[] = [];

    onLoad() {
        for (const n of this.hideWhileSelecting) n.active = false;
        this.cards.forEach((card, i) => {
            this._cardScales.push(card.scale.clone());
            card.on(Node.EventType.TOUCH_END, () => this.choose(i), this);
            this.pulse(card, i);
        });
        this.playHand(0);
    }

    onDestroy() {
        for (const card of this.cards) Tween.stopAllByTarget(card);
        if (this.hand) Tween.stopAllByTarget(this.hand);
    }

    update() {
        this.fit();
    }

    private choose(index: number): void {
        if (this._chosen) return;
        this._chosen = true;
        if (this.hand) { Tween.stopAllByTarget(this.hand); this.hand.active = false; }
        this.cards.forEach((card, i) => {
            Tween.stopAllByTarget(card);
            const s = this._cardScales[i];
            if (i === index) tween(card).to(0.15, { scale: Vec3.multiplyScalar(new Vec3(), s, 1.15) }, { easing: 'backOut' }).start();
            else tween(card).to(0.15, { scale: Vec3.multiplyScalar(new Vec3(), s, 0.85) }).start();
        });
        this.scheduleOnce(() => {
            for (const n of this.hideWhileSelecting) n.active = true;
            this.node.active = false;
            GameManager.Ins?.selectCharacter(index);
        }, 0.3);
    }

    /** Nhun nhe tung the, lech pha nhau. */
    private pulse(card: Node, i: number): void {
        const s = this._cardScales[i];
        tween(card).delay(i * 0.4)
            .then(tween(card)
                .to(0.4, { scale: Vec3.multiplyScalar(new Vec3(), s, 1.05) }, { easing: 'sineInOut' })
                .to(0.4, { scale: s }, { easing: 'sineInOut' })
                .union()
                .repeatForever())
            .start();
    }

    /** Tay chi cham the i, roi chuyen sang the tiep theo. */
    private playHand(i: number): void {
        const hand = this.hand, card = this.cards[i];
        if (!hand || !card || this._chosen) return;
        const p = card.position;
        const target = new Vec3(p.x + 50, p.y + 40, hand.position.z);
        const op = hand.getComponent(UIOpacity) ?? hand.addComponent(UIOpacity);
        Tween.stopAllByTarget(hand);
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        hand.setPosition(target.x + 80, target.y - 80, target.z);
        tween(op).to(0.2, { opacity: 255 }).start();
        tween(hand)
            .to(0.35, { position: target }, { easing: 'quadOut' })
            .to(0.12, { scale: new Vec3(0.85, 0.85, 1) })
            .to(0.12, { scale: Vec3.ONE })
            .delay(0.5)
            .call(() => this.playHand((i + 1) % this.cards.length))
            .start();
    }

    /** Khung nhin cua UICam (ortho) -> ve lai nen + scale Content cho vua. */
    private fit(): void {
        if (!this.uiCamera) return;
        const size = view.getVisibleSize();
        const halfH = this.uiCamera.orthoHeight;
        const halfW = halfH * size.width / Math.max(1, size.height);
        if (halfW === this._halfW && halfH === this._halfH) return;
        this._halfW = halfW;
        this._halfH = halfH;

        const ws = this.node.worldScale;
        const w = halfW / ws.x, h = halfH / ws.y;
        if (this.dim) {
            const ds = this.dim.node.scale;
            this.dim.setContentSize(w * 2.2 / ds.x, h * 2.2 / ds.y);
        }
        if (this.content) {
            const k = Math.min(2 * w * this.fitRatio / this.designWidth, 2 * h * this.fitRatio / this.designHeight);
            this.content.setScale(k, k, 1);
        }
    }
}
