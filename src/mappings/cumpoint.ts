import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { CumPoint, Pair, CumpointEvent } from "../types/schema";
import { ZERO_BD } from "./helpers";


export function cumPointTracker(liquidity: BigDecimal, timestamp: BigInt, from: Address, pair: Pair, isIncrease: boolean, txHash: Bytes): void {
    let cumPoint = CumPoint.load(from.toHexString())
    if (cumPoint == null) {
        cumPoint = new CumPoint(from.toHexString())
        cumPoint.events = []
        cumPoint.currentBalance = ZERO_BD
    }

    let event = new CumpointEvent(txHash.toHexString())
    event.pair = pair.id
    event.user = from
    event.isAddLiquidity = isIncrease
    event.liquidity = liquidity
    event.timestamp = timestamp

    event.save()

    let events = cumPoint.events
    events.push(event.id)

    cumPoint.events = events
    cumPoint.lastUpdate = timestamp
    cumPoint.user = from

    let currentBalance = cumPoint.currentBalance
    if (isIncrease) {
        cumPoint.currentBalance = currentBalance.plus(liquidity)
    } else {
        cumPoint.currentBalance = currentBalance.minus(liquidity)
    }

    cumPoint.save()
}
