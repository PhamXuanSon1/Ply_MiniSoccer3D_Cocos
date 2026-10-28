import { _decorator, Component, js } from 'cc';
const { ccclass } = _decorator;

/**
 * Lop Singleton co ban cho cac component trong Cocos Creator.
 * Ke thua lop nay de tao cac singleton manager.
 * 
 * Cach dung: class MyManager extends Ply_Singleton { ... }
 * Truy cap qua: MyManager.Ins
 * 
 * Luu y: TypeScript khong ho tro generic static member giong C#,
 * nen moi subclass can tu gan Ins trong onLoad cua chinh me.
 */
@ccclass('Ply_Singleton')
export class Ply_Singleton extends Component {

    private static _instances: Map<string, Ply_Singleton> = new Map();

    /**
     * Ghi de phuong thuc nay trong subclass va goi super.onLoad().
     * Cac subclass nen tu gan gian tri cho bien static Ins cua minh.
     */
    onLoad() {
        const className = Ply_Singleton.keyOf(this);
        if (Ply_Singleton._instances.has(className)) {
            this.node.destroy();
            return;
        }
        Ply_Singleton._instances.set(className, this);
    }

    /**
     * Key = ten @ccclass (khong bi minify khi build release).
     * constructor.name co the bi doi thanh 'e', 't'... -> 2 manager khac nhau trung key.
     */
    private static keyOf(comp: Component): string {
        return js.getClassName(comp) || (comp.constructor as any).name;
    }

    onDestroy() {
        const className = Ply_Singleton.keyOf(this);
        if (Ply_Singleton._instances.get(className) === this) {
            Ply_Singleton._instances.delete(className);
        }
    }
}
