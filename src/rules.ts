import { ORDER, type BallId, type ObjectId } from './spec.ts'

export type Player = 0 | 1

export interface Match {
  scores: [number, number]
  current: Player
  breaker: Player
  ballInHand: boolean
  shotIsBallInHand: boolean
  isBreakShot: boolean
  isBreakVisit: boolean
  breakWasDry: boolean
  breakPocketed: number
  nineOnBreak: boolean
  visitFromRanggan: boolean
  passedFromBreakVisit: boolean
  allUpAtVisitStart: boolean
  oneOffAtVisitStart: boolean
  visitPocketed: ObjectId[]
  rack: number
  rackOver: boolean
  gameOver: boolean
  lastCall: string
  winner: Player | null
  loser: Player | null
}

export interface ShotFacts {
  legal: ObjectId
  first: BallId | 'cushion' | 'none'
  pocketed: BallId[]
  off: BallId[]
  nineStruckBy: BallId | null
  upBefore: ObjectId[]
}

export interface ResolveResult {
  spot: ObjectId[]
  rackOver: boolean
}

export function createMatch(): Match {
  return {
    scores: [0, 0],
    current: 0,
    breaker: 0,
    ballInHand: false,
    shotIsBallInHand: false,
    isBreakShot: true,
    isBreakVisit: true,
    breakWasDry: true,
    breakPocketed: 0,
    nineOnBreak: false,
    visitFromRanggan: false,
    passedFromBreakVisit: false,
    allUpAtVisitStart: true,
    oneOffAtVisitStart: false,
    visitPocketed: [],
    rack: 1,
    rackOver: false,
    gameOver: false,
    lastCall: '开球',
    winner: null,
    loser: null,
  }
}

export function onShotStart(m: Match) {
  m.shotIsBallInHand = m.ballInHand
  m.ballInHand = false
  m.rackOver = false
  m.winner = null
  m.loser = null
}

export function nextRack(m: Match, breaker: Player) {
  m.breaker = breaker
  m.current = breaker
  m.ballInHand = false
  m.shotIsBallInHand = false
  m.isBreakShot = true
  m.isBreakVisit = true
  m.breakWasDry = true
  m.breakPocketed = 0
  m.nineOnBreak = false
  m.visitFromRanggan = false
  m.passedFromBreakVisit = false
  m.allUpAtVisitStart = true
  m.oneOffAtVisitStart = false
  m.visitPocketed = []
  m.rack += 1
  m.rackOver = false
  m.lastCall = '开球'
  m.winner = null
  m.loser = null
}

export function canOfferPass(m: Match, edgesOpen: boolean): boolean {
  return !m.gameOver && !m.rackOver && !m.ballInHand && !edgesOpen
}

export function passShot(m: Match, up: ObjectId[]) {
  if (m.isBreakVisit) m.passedFromBreakVisit = true
  m.visitFromRanggan = true
  m.current = m.current === 0 ? 1 : 0
  m.isBreakVisit = false
  m.isBreakShot = false
  m.visitPocketed = []
  m.ballInHand = false
  m.allUpAtVisitStart = ORDER.every((id) => up.includes(id))
  m.oneOffAtVisitStart = !up.includes('1')
  m.lastCall = '让杆'
}

function other(p: Player): Player {
  return p === 0 ? 1 : 0
}

function objs(ids: BallId[]): ObjectId[] {
  return ids.filter((id): id is ObjectId => id !== 'cue')
}

function upsAfter(facts: ShotFacts, spot: ObjectId[]): Set<ObjectId> {
  const up = new Set<ObjectId>(facts.upBefore)
  for (const id of objs(facts.pocketed)) up.delete(id)
  for (const id of objs(facts.off)) up.delete(id)
  for (const id of spot) up.add(id)
  return up
}

function award(m: Match, player: Player, name: string, pts: number) {
  m.scores[player] += pts
  m.lastCall = `${name} +${pts}`
  m.rackOver = true
  m.winner = player
  m.loser = other(player)
  m.ballInHand = false
  m.visitFromRanggan = false
}

function finishVisit(m: Match, up: Set<ObjectId>, hand: boolean) {
  m.current = other(m.current)
  m.isBreakShot = false
  m.isBreakVisit = false
  m.visitFromRanggan = false
  m.passedFromBreakVisit = false
  m.visitPocketed = []
  m.ballInHand = hand
  m.shotIsBallInHand = false
  m.allUpAtVisitStart = ORDER.every((id) => up.has(id))
  m.oneOffAtVisitStart = !up.has('1')
}

export function resolve(m: Match, facts: ShotFacts): ResolveResult {
  const pocketedObj = objs(facts.pocketed)
  const nineDown = facts.pocketed.includes('9') || facts.off.includes('9')
  const foul =
    facts.first !== facts.legal ||
    facts.pocketed.includes('cue') ||
    facts.off.includes('cue') ||
    facts.off.some((id) => id !== 'cue')

  if (foul) {
    const spot: ObjectId[] = []
    for (const id of objs(facts.off)) {
      if (!spot.includes(id)) spot.push(id)
    }
    if (facts.pocketed.includes('9') && !spot.includes('9')) spot.push('9')
    const up = upsAfter(facts, spot)
    finishVisit(m, up, true)
    m.scores[m.current] += 1
    m.lastCall = '犯规 +1'
    m.rackOver = false
    return { spot, rackOver: false }
  }

  if (m.isBreakShot) {
    m.breakPocketed = pocketedObj.length
    m.breakWasDry = pocketedObj.length === 0
    m.nineOnBreak = facts.pocketed.includes('9')
  }

  for (const id of pocketedObj) {
    if (!m.visitPocketed.includes(id)) m.visitPocketed.push(id)
  }

  if (facts.pocketed.includes('9')) {
    const combination = facts.nineStruckBy !== 'cue'
    const byCue = !combination
    const up = upsAfter(facts, [])
    const allDown = ORDER.every((id) => !up.has(id))
    const ranAllFour = ORDER.every((id) => m.visitPocketed.includes(id))

    if (m.shotIsBallInHand && combination) {
      award(m, other(m.current), '普胜', 4)
      return { spot: [], rackOver: true }
    }
    if (m.isBreakShot) {
      award(m, m.current, '黄金九', 4)
      return { spot: [], rackOver: true }
    }
    if (combination) {
      const pts = m.visitFromRanggan ? 8 : 4
      const name = m.visitFromRanggan ? '让杆 普胜' : '普胜'
      award(m, m.current, name, pts)
      return { spot: [], rackOver: true }
    }
    const dajin =
      byCue &&
      allDown &&
      m.breakPocketed >= 1 &&
      !m.nineOnBreak &&
      ((m.current === m.breaker && m.isBreakVisit && !m.isBreakShot) ||
        (m.visitFromRanggan && m.passedFromBreakVisit))
    const xiaojin =
      byCue &&
      m.breakWasDry &&
      m.allUpAtVisitStart &&
      ranAllFour &&
      (m.current !== m.breaker || m.visitFromRanggan)
    if (dajin) {
      const pts = m.visitFromRanggan ? 20 : 10
      award(m, m.current, m.visitFromRanggan ? '让杆 大金' : '大金', pts)
      return { spot: [], rackOver: true }
    }
    if (xiaojin) {
      const pts = m.visitFromRanggan ? 14 : 7
      award(m, m.current, m.visitFromRanggan ? '让杆 小金' : '小金', pts)
      return { spot: [], rackOver: true }
    }
    const pts = m.visitFromRanggan ? 8 : 4
    award(m, m.current, m.visitFromRanggan ? '让杆 普胜' : '普胜', pts)
    return { spot: [], rackOver: true }
  }

  void nineDown

  if (pocketedObj.length > 0) {
    m.isBreakShot = false
    m.ballInHand = false
    m.shotIsBallInHand = false
    m.lastCall = '进球'
    return { spot: [], rackOver: false }
  }

  const up = upsAfter(facts, [])
  finishVisit(m, up, false)
  if (m.lastCall === '开球' || m.lastCall === '进球' || m.lastCall === '让杆') m.lastCall = '换人'
  return { spot: [], rackOver: false }
}

export function runRuleChecks() {
  const base = (): ShotFacts => ({
    legal: '1',
    first: '1',
    pocketed: [],
    off: [],
    nineStruckBy: null,
    upBefore: ['1', '2', '3', '9'],
  })

  let m = createMatch()
  onShotStart(m)
  let r = resolve(m, { ...base(), pocketed: ['9'], nineStruckBy: '1' })
  if (!r.rackOver || m.scores[0] !== 4 || !m.lastCall.includes('黄金九')) {
    throw new Error(`golden ${m.lastCall} ${m.scores}`)
  }

  m = createMatch()
  onShotStart(m)
  r = resolve(m, { ...base(), pocketed: ['9', 'cue'], nineStruckBy: 'cue' })
  if (r.rackOver || m.scores[1] !== 1 || !r.spot.includes('9') || !m.ballInHand) {
    throw new Error(`scratch ${m.lastCall} ${JSON.stringify(r)}`)
  }

  m = createMatch()
  onShotStart(m)
  r = resolve(m, { ...base(), first: '9', pocketed: ['9'], nineStruckBy: 'cue' })
  if (r.rackOver || m.lastCall !== '犯规 +1' || !r.spot.includes('9')) {
    throw new Error(`wrong first ${m.lastCall}`)
  }

  m = createMatch()
  onShotStart(m)
  resolve(m, base())
  if (m.current !== 1 || !m.breakWasDry) throw new Error('dry turn')
  onShotStart(m)
  r = resolve(m, {
    ...base(),
    pocketed: ['1', '2', '3', '9'],
    nineStruckBy: 'cue',
  })
  if (!r.rackOver || m.scores[1] !== 7 || !m.lastCall.includes('小金')) {
    throw new Error(`xiaojin ${m.lastCall} ${m.scores}`)
  }

  m = createMatch()
  onShotStart(m)
  resolve(m, { ...base(), pocketed: ['1'], upBefore: ['1', '2', '3', '9'] })
  if (m.current !== 0 || m.breakPocketed !== 1) throw new Error('continue break')
  onShotStart(m)
  r = resolve(m, {
    legal: '2',
    first: '2',
    pocketed: ['2', '3', '9'],
    off: [],
    nineStruckBy: 'cue',
    upBefore: ['2', '3', '9'],
  })
  if (!r.rackOver || m.scores[0] !== 10 || !m.lastCall.includes('大金')) {
    throw new Error(`dajin ${m.lastCall} ${m.scores}`)
  }

  m = createMatch()
  onShotStart(m)
  resolve(m, { ...base(), pocketed: ['1'] })
  onShotStart(m)
  r = resolve(m, {
    legal: '2',
    first: '2',
    pocketed: ['2', '3', '9'],
    off: [],
    nineStruckBy: '2',
    upBefore: ['2', '3', '9'],
  })
  if (!m.lastCall.includes('普胜') || m.scores[0] !== 4 || m.lastCall.includes('大金')) {
    throw new Error(`combo dajin override ${m.lastCall}`)
  }

  m = createMatch()
  m.isBreakShot = false
  m.isBreakVisit = false
  m.breakWasDry = false
  m.ballInHand = true
  m.current = 0
  onShotStart(m)
  r = resolve(m, {
    ...base(),
    pocketed: ['9'],
    nineStruckBy: '1',
  })
  if (m.scores[1] !== 4 || m.scores[0] !== 0 || m.loser !== 0) {
    throw new Error(`bih ${m.lastCall} ${m.scores}`)
  }

  m = createMatch()
  m.isBreakShot = false
  m.isBreakVisit = false
  m.current = 0
  onShotStart(m)
  r = resolve(m, { ...base(), first: 'none' })
  if (m.scores[1] !== 1 || !m.ballInHand || Number(m.current) !== 1) throw new Error('miss foul')

  m = createMatch()
  const legalPlayer = m.current
  const legalScores: [number, number] = [m.scores[0], m.scores[1]]
  onShotStart(m)
  resolve(m, base())
  if (
    m.current === legalPlayer ||
    m.scores[0] !== legalScores[0] ||
    m.scores[1] !== legalScores[1] ||
    m.lastCall.includes('犯规')
  ) {
    throw new Error(`legal hit ${m.lastCall} player ${m.current} ${m.scores}`)
  }

  m = createMatch()
  m.isBreakShot = false
  m.isBreakVisit = false
  m.breakWasDry = false
  m.current = 1
  m.visitFromRanggan = true
  m.oneOffAtVisitStart = true
  m.allUpAtVisitStart = false
  onShotStart(m)
  r = resolve(m, {
    legal: '2',
    first: '2',
    pocketed: ['2', '3', '9'],
    off: [],
    nineStruckBy: 'cue',
    upBefore: ['2', '3', '9'],
  })
  if (m.scores[1] !== 8 || !m.lastCall.includes('普胜') || !m.lastCall.includes('8')) {
    throw new Error(`double ${m.lastCall} ${m.scores}`)
  }

  m = createMatch()
  onShotStart(m)
  resolve(m, base())
  passShot(m, ['1', '2', '3', '9'])
  if (m.current !== 0 || !m.visitFromRanggan) throw new Error('pass back')
  onShotStart(m)
  r = resolve(m, {
    ...base(),
    pocketed: ['1', '2', '3', '9'],
    nineStruckBy: 'cue',
  })
  if (m.scores[0] !== 14 || !m.lastCall.includes('小金')) {
    throw new Error(`xiaojin double ${m.lastCall} ${m.scores}`)
  }
}
