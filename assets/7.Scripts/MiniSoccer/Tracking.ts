import { _decorator, Component } from 'cc';
import { AppLovinAnalytics } from '../Tool/AppLovinAnalytics';
import { GameController, gc } from '../Tool/GameController';
import { GameEvent, gameEvents } from './GameManager';
const { ccclass } = _decorator;

/**
 * Event AppLovin theo gameplay (ProgressTrackingManager ben Unity).
 * LOADING/LOADED/DISPLAYED da tu ban trong AppLovinAnalytics.ts.
 * Khac ban Unity: CHALLENGE_SOLVED/FAILED chi ban 1 lan khi chot ket qua (ban Unity ban SOLVED o moc 100% va ca khi thang).
 */
@ccclass('Tracking')
export class Tracking extends Component {

    private _passed = new Set<number>();

    start() {
        gameEvents.on(GameEvent.START, () => AppLovinAnalytics.challengeStarted(), this);
        gameEvents.on(GameEvent.GATE_PASSED, this.onGatePassed, this);
        gameEvents.on(GameEvent.FINISHED, (isWin: boolean) => isWin ? AppLovinAnalytics.challengeSolved() : AppLovinAnalytics.challengeFailed(), this);
        gameEvents.on(GameEvent.ENDCARD_SHOWN, () => AppLovinAnalytics.endcardShown(), this);
        gameEvents.on(GameEvent.STORE_CLICKED, () => AppLovinAnalytics.ctaClicked(), this);
        gc?.node.once(GameController.EVENT_STOP, () => AppLovinAnalytics.ctaClicked(), this);
    }

    onDestroy() {
        gameEvents.targetOff(this);
        gc?.node.targetOff(this);
    }

    private onGatePassed(index: number, total: number): void {
        const pct = (index + 1) / total * 100;
        const marks: [number, () => void][] = [[25, () => AppLovinAnalytics.challenge25()], [50, () => AppLovinAnalytics.challenge50()], [75, () => AppLovinAnalytics.challenge75()]];
        for (const [mark, fire] of marks) {
            if (pct >= mark && !this._passed.has(mark)) {
                this._passed.add(mark);
                fire();
            }
        }
    }
}
