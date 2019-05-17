const Jrn = require('jsonre')
const msg = require('./constant')

class Engine extends Jrn {
  constructor (redisCli) {
    super(undefined, {
      allowUndefinedFacts: true
    })
    this.redis = redisCli
    // 存储rulename 和 具体rule/timer的索引map
    this.ruleMap = new Map()
  }

  // 删除规则
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

  // 增加规则
  async addRule (ruleName, definition, opt = { cache: true }) {
    // add rule in JRN
    const define = this._ruleFormat(definition)

    const { rules } = super.addRule(define.rule)
    this.ruleMap.set(ruleName, `${rules.length - 1},${define.timer.map(t => t.id).join(',')}`)

    // save rule in redis
    if (opt.cache) await this.redis.hset(msg.RULEMAP, ruleName, JSON.stringify(definition))
    return true
  }

  // 增加fact
  async addFact (factId, value, opt = { cache: true }) {
    if (opt.cache) await this.redis.hset(msg.FACTMAP, factId, value)
    super.addFact(factId, value)
  }

  // 清理runtime中的规则
  clearRules () {
    super.clearRules()
    this.ruleMap = new Map()
  }

  // 从redis缓存加载规则
  async addRulesFromCache () {
    const rules = await this.redis.hgetall(msg.RULEMAP)
    rules.forEach((r) => {
      const key = Object.keys(r)[0]
      this.addRule(key, JSON.stringify(r[key]), { cache: false })
    })
  }

  // 从redis缓存加载fact
  async addFactsFromCache () {
    const facts = await this.redis.hgetall(msg.FACTMAP)
    facts.forEach((r) => {
      const key = Object.keys(r)[0]
      this.addFact(key, r[key], { cache: false })
    })
  }

  // 将规则格式化，拆分组合定时规则
  _ruleFormat (definition) {
    const { timers } = definition
    if (!timers) return { rule: definition, timer: [] }
    const ret = Object.assign({}, definition)

    // TODO timer handle
    return { rule: ret, timer: timers }
  }
}

module.exports = Engine
