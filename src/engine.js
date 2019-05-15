const Jrn = require('jsonre')
const msg = require('./constant')

class Engine extends Jrn {
  constructor (redisCli) {
    super(undefined, {
      allowUndefinedFacts: true
    })
    this.redis = redisCli
    this.ruleMap = new Map()
  }

  async ensureRule (ruleName) {
    // memory cache ensure
    if (this.ruleMap.has(ruleName)) return true

    // redis cache ensure
    const definition = await this.redis.hget(msg.RULEMAP, ruleName)
    if (definition) {
      super.addRule(JSON.parse(definition))
    } else {
      throw new Error(msg.ERR_RULE_EXIST)
    }
  }

  async deleteRule (ruleName) {
    // delete redis cache
    await this.redis.hdel(msg.ruleMap, ruleName)

    // if exist delete cache
    const rule = this.ruleMap.get(ruleName)
    if (!rule) return
    const ruleIndex = parseInt(this.ruleMap.get(ruleName).split(',')[0])
    if (ruleIndex || ruleIndex == 0) {
      super.removeRule(super.getRuleByIndex(ruleIndex))
      this.ruleMap = this.ruleMap.delete(ruleName)
      // TODO delete timer
      // TODO delete fact
    }
  }

  async addRule (ruleName, definition) {
    // add rule in JRN
    if (this.ruleMap.has(ruleName)) throw new Error(msg.ERR_RULE_EXIST)
    const define = this._ruleFormat(definition)

    const { rules } = super.addRule(define.rule)
    this.ruleMap.set(ruleName, `${rules.length - 1},${define.timer.map(t => t.id).join(',')}`)

    // save rule in redis
    await this.redis.hset(msg.RULEMAP, ruleName, JSON.stringify(definition))
    return true
  }

  async addFact (factId, value) {
    await this.redis.hset(msg.FACTMAP, factId, value)
    super.addFact(factId, value)
  }

  _ruleFormat (definition) {
    const { timers } = definition
    if (!timers) return { rule: definition, timer: [] }
    const ret = Object.assign({}, definition)

    // TODO timer handle
    return { rule: ret, timer: timers }
  }
}

module.exports = Engine
