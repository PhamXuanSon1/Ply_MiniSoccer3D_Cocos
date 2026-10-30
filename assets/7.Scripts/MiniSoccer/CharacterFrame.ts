import { _decorator, CCFloat, Node, Sprite, SpriteFrame, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 1 anh nhan vat (1 level / anh thang) + chinh rieng cho anh do de cac anh to deu nhau, chan cham dat.
 * Anh giu kich thuoc goc (800px); node chua sprite tu scale cho vua.
 * Chinh bang CharacterTuner (tren node Character) de xem truc tiep trong Scene.
 */
@ccclass('CharacterFrame')
export class CharacterFrame {
    @property(SpriteFrame)
    frame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Silhouette mo cua anh (ply24/Glow/*_glow.png), dung lam hao quang max level' })
    glow: SpriteFrame | null = null;

    @property({ type: CCFloat, tooltip: 'Phong to rieng anh nay (vd anh dang chay cui nguoi thi < 1)' })
    scale = 1;

    @property({ tooltip: 'Lech vi tri theo px anh goc (y am = ha xuong cho chan cham dat)' })
    offset = new Vec2();
}

/** Vi tri / scale goc cua node sprite truoc khi ap CharacterFrame. */
export class FrameBase {
    readonly pos = new Vec3();
    readonly scale = new Vec3(1, 1, 1);

    constructor(node?: Node | null) {
        if (node) { this.pos.set(node.position); this.scale.set(node.scale); }
    }
}

/** Ap anh + scale + offset cua CharacterFrame len sprite (giu kich thuoc goc cua anh). */
export function applyFrame(sprite: Sprite, f: CharacterFrame | null, base: FrameBase, extraScale = 1): void {
    setRawFrame(sprite, f?.frame ?? null);
    place(sprite.node, f, base, extraScale);
}

/**
 * Ap glow cua CharacterFrame: anh glow co padding quanh anh goc nen dat anchor sao cho trung khit voi body.
 * body: sprite dang hien CharacterFrame (lay anchor + kich thuoc).
 */
export function applyGlow(glow: Sprite, f: CharacterFrame | null, body: Sprite, base: FrameBase, extraScale = 1): void {
    setRawFrame(glow, f?.glow ?? null);
    const g = glow.getComponent(UITransform), b = body.getComponent(UITransform);
    if (g && b && f?.glow) {
        const gw = g.width, gh = g.height;
        g.setAnchorPoint((b.anchorX * b.width + (gw - b.width) / 2) / gw, (b.anchorY * b.height + (gh - b.height) / 2) / gh);
    }
    place(glow.node, f, base, extraScale);
}

function setRawFrame(sprite: Sprite, frame: SpriteFrame | null): void {
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    // Kich thuoc theo originalSize nen khong trim (trim se keo gian phan anh da cat vien)
    sprite.trim = false;
    sprite.spriteFrame = frame;
    if (frame) sprite.getComponent(UITransform)?.setContentSize(frame.originalSize);
}

function place(node: Node, f: CharacterFrame | null, base: FrameBase, extraScale: number): void {
    const k = (f?.scale ?? 1) * extraScale;
    node.setScale(base.scale.x * k, base.scale.y * k, base.scale.z);
    const ox = f?.offset.x ?? 0, oy = f?.offset.y ?? 0;
    node.setPosition(base.pos.x + ox * base.scale.x, base.pos.y + oy * base.scale.y, base.pos.z);
}
