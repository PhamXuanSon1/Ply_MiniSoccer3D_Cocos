import { _decorator, Component, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { GameEvent, gameEvents } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * O "?" tren HUD (UICheckBoxHolder ben Unity): qua cong thu i thi o thu i doi sang hinh vua chon.
 * Hinh moi giu ti le, nam gon trong khung cua icon "?".
 */
@ccclass('ChoiceTicks')
export class ChoiceTicks extends Component {

    @property({ type: [Sprite], tooltip: 'Icon cua tung o theo thu tu cong (Tick_1/Icon ...)' })
    icons: Sprite[] = [];

    private _boxes: Size[] = [];

    onLoad() {
        this._boxes = this.icons.map(s => s.getComponent(UITransform)!.contentSize.clone());
        gameEvents.on(GameEvent.GATE_PASSED, this.onGatePassed, this);
    }

    onDestroy() {
        gameEvents.targetOff(this);
    }

    private onGatePassed(index: number, _total: number, _type: number, visual: SpriteFrame | null): void {
        const icon = this.icons[index];
        if (!icon || !visual) return;
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        icon.spriteFrame = visual;
        const box = this._boxes[index], src = visual.originalSize;
        const k = Math.min(box.width / src.width, box.height / src.height);
        icon.getComponent(UITransform)!.setContentSize(src.width * k, src.height * k);
    }
}
