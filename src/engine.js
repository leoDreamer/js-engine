const Jrn = require('jsonre')
const msg = require('./constant')
const Timer = require('./timer')

class Engine extends Jrn {
  /**
   * returns a new Rule instance
   * @param {RedisClient} redisCli redis 实例
   * @param {object,string} opt, or json string that can be parsed into options
   * @param {boolean} opt.runTimer 当前进程是否启用定时器
   * @param {boolean} opt.updateFactBeforeRun 每次run前是否从redis加载所有fact
   * @return {Rule} instance
   */
  constructor (redisCli, opt) {
    super(undefined, {
      allowUndefinedFacts: true
    })
    this.opt = Object.assign({
      runTimer: false,
      updateFactBeforeRun: false
    }, opt)
    this.redis = redisCli
    // 存储rulename 和 具体rule/timer的索引map
    this.ruleMap = new Map()
    this.runTimer = opt.runTimer
    if (opt.runTimer) this.timer = new Timer(this)
  }

  /**
   * 删除规则 + 定时器 + redis cache
   * @param  {String} ruleName 规则名称
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async deleteRule (ruleName) {
    // delete redis cache
    await this.redis.hdel(msg.ruleMap, ruleName)

    const indexCache = this.ruleMap.get(ruleName)
    if (!indexCache) return
    // 删除 runtime 中rule
    const ruleIndex = parseInt(indexCache.split(',')[0])
    if (ruleIndex || ruleIndex == 0) {
      super.removeRule(super.getRuleByIndex(ruleIndex))
      this.ruleMap.delete(ruleName)
    }
    // 删除定时器
    if (this.runTimer && indexCache.split(',').slice(1).length > 0) {
      indexCache.split(',').slice(1).forEach(t => {
        this.timer.deleteTimer(t)
      })
    }
  }

  /**
   * 增加规则
   * @param  {String} ruleName 规则名称
   * @param  {Object} definition 规则的定义(参见测试代码)
   * @param  {object,string} opt 配置项
   * @param  {boolean} opt.cache 是否添加缓存
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async addRule (ruleName, definition, opt = { cache: true }) {
    // add rule in JRN
    // 同名规则不重复创建，直接返回
    if (this.ruleMap.has(ruleName)) return 
    const define = this._ruleFormat(definition)

    const { rules } = super.addRule(define.rule)
    this.ruleMap.set(ruleName, `${rules.length - 1},${define.timers.map(t => t.id).join(',')}`)

    // save rule in redis
    if (opt.cache) await this.redis.hset(msg.RULEMAP, ruleName, JSON.stringify(definition))
    // 创建定时器
    if (this.runTimer) {
      define.timers.forEach(t => {
        this.timer.addTimer(t.id, t.rule, t.range[0], t.range[1])
      })
    }
    return true
  }

  /**
   * 增加fact
   * @param  {String} factId fact id（对应规则definition中的fact字段）
   * @param  {String} value fact的值
   * @param  {object,string} opt 配置项
   * @param  {boolean} opt.cache 是否添加缓存
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async addFact (factId, value, opt = { cache: true }) {
    if (opt.cache) await this.redis.hset(msg.FACTMAP, factId, value)
    super.addFact(factId, value)
  }

  /**
   * 清理runtime中的规则(不会清理缓存)
   */
  clearRules () {
    super.clearRules()
    this.ruleMap.clear()
  }

  /**
   * 从redis缓存加载所有规则
   */
  async addRulesFromCache () {
    const rules = await this.redis.hgetall(msg.RULEMAP)
    Object.keys(rules).forEach(key => {
      this.addRule(key, JSON.parse(rules[key]), { cache: false })
    })
  }

  /**
   * 从redis缓存加载所有fact
   */
  async addFactsFromCache () {
    const facts = await this.redis.hgetall(msg.FACTMAP)
    Object.keys(facts).forEach(key => {
      this.addFact(key, JSON.parse(facts[key]), { cache: false })
    })
  }

  /**
   * Runs an array of rules
   * @param  {Rule[]} array of rules to be evaluated
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async run (event) {
    if (this.opt.updateFactBeforeRun) await this.addFactsFromCache()
    super.run(event)
      .then(ret => {
        console.log(`fire rule ${JSON.stringify(ret)}`)
        return ret
      })
  }

  /**
   * 将规则格式化，拆分组合定时规则
   * @param  {Rule[]} array of rules to be evaluated
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  _ruleFormat (definition) {
    const { timers, conditions, event } = definition
    if (!timers) return { rule: definition, timers: [] }

    // 将定时 作为 true/false 加入json-rule
    // 条件定时器 直接加入json-rule的condition中
    // 限制定时器 与原有condition重新组合成all条件
    const conditionsKey = Object.keys(conditions)[0]
    const rules = conditions[conditionsKey]
    let limitTimer = null
    timers.forEach(t => {
      const rule = {
        fact: t.id,
        operator: 'equal',
        value: true
      }
      if (t.type === 'CONDITION') {
        rules.push(rule)
      } else if (t.type === 'LIMIT') {
        limitTimer = rule
      }
    })

    return { 
      rule: {
        event,
        conditions: limitTimer
          ? { all: [ limitTimer, { [conditionsKey]: rules } ] }
          : { [conditionsKey]: rules }
      },
      timers
    }
  }
}

module.exports = Engine
