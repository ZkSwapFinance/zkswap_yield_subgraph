/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, ONE_BD } from './helpers'


const WETH_ADDRESS = '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'
const USDC_WETH_PAIR = '0x7642e38867860d4512fcce1116e2fb539c5cdd21' // created 10008355
const USDT_WETH_PAIR = '0xA6e443251D6b4Ecd0bf7665834838Ca8B4280A13' // created block 10093341


export function getEthPriceInUSD(): BigDecimal {
  //For now we will only use USDC_WETH pair for ETH prices
  let usdcPair = Pair.load(USDC_WETH_PAIR);  // usdc is token0
  let usdtPair = Pair.load(USDT_WETH_PAIR) // usdt is token0

  // all 3 have been created
  if (usdcPair !== null && usdtPair !== null) {
    let totalLiquidityETH = usdcPair.reserve1.plus(usdtPair.reserve1)
    let usdcWeight = usdcPair.reserve1.div(totalLiquidityETH)
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityETH)
    return usdcPair.token0Price
      .times(usdcWeight)
      .plus(usdtPair.token1Price.times(usdtWeight))
      
  } else if (usdtPair !== null) {
    let totalLiquidityETH = usdtPair.reserve1
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityETH)
    return usdtPair.token1Price.times(usdtWeight)
    
  } else if (usdcPair !== null) {
    return usdcPair.token0Price
  } else {
    return ZERO_BD
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  WETH_ADDRESS,
  '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', // USDC
  '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', // USDT
]

let BLACKLIST: string[] = [
]

export function isOnWhitelist(token: string): boolean {
  for(var i = 0; i < WHITELIST.length; i++) {
    if(token == WHITELIST[i]) return true
  }
  return false
}

export function isOnBlacklist(token: string): boolean {
  for(var i = 0; i < BLACKLIST.length; i++) {
    if(token == BLACKLIST[i]) return true
  }
  return false
}

export function addToBlackList(token: string): void {
  BLACKLIST.push(token);
}
// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('1')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD
  }

  // loop through whitelist and check if paired with any
  let whitelist = token.whitelist
  for (let i = 0; i < whitelist.length; ++i) {
      let pairAddress = whitelist[i]
      let pair = Pair.load(pairAddress)
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * ETH per token 0
      }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  bundle: Bundle
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  bundle: Bundle
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
