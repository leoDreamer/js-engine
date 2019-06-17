const Jrn = require('jsonre')
const msg = require('./constant')
const Timer = require('./timer')
const Redis = require('./redis')

class Engine extends Jrn {
  /**
   * returns a new Rule instance
   * @param {boolean} opt.runTimer 当前进程是否启用定时器
   * @param {boolean} opt.updateFactBeforeRun 每次run前是否从redis加载所有fact
   * @param {boolean} opt.pub 是否同步每个进程的rule/fact
   * @param {object}  opt.redis redis 配置 eggjs 的redis配置
   * @return {Rule} instance
   */
  constructor (opt) {
    super(undefined, {
      allowUndefinedFacts: true
    })
    // 默认配置
    this.opt = Object.assign({
      runTimer: false,
      updateFactBeforeRun: false,
      pubSub: false,
      redis: {
        client: {
          port: 6379,
          host: '127.0.0.1',
          password: '',
          db: 0
        }
      }
    }, opt)
    this.redisObj = new Redis(this.opt.redis, this)
    this.ruleMap = new Map() // 存储定时器map
    this.ruleNameArray = [] // 对应json-rules-engine中rule(一一对应)
  
    this.runTimer = this.opt.runTimer
    if (this.opt.runTimer) this.timer = new Timer(this)
    this.redis = this.redisObj.client
    this.redisObj.subAll()
  }

  /**
   * 删除规则 + 定时器 + redis cache
   * @param  {String} ruleName 规则名称
   * @param  {object string} option 配置项
   * @param  {boolean} option.pub 同步到各个进程
   * @param  {boolean} option.cache 缓存到redis
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async deleteRule (ruleName, option ) {
    const opt = Object.assign({ pub: false, cache: true }, option)
    const rule = await this.redis.hget(msg.RULEMAP, ruleName)

    // delete redis cache
    if (opt.cache && rule) await this.redis.hdel(msg.RULEMAP, ruleName)

    const timerIndexCache = this.ruleMap.get(ruleName)
    const ruleIndexCache = this.ruleNameArray.indexOf(ruleName)

    // 删除 runtime 中rule
    super.removeRuleByIndex(ruleIndexCache)
    this.ruleMap.delete(ruleName)
    if (ruleIndexCache > -1) this.ruleNameArray.splice(ruleIndexCache, 1)

    // 删除定时器
    if (this.runTimer && timerIndexCache && timerIndexCache.split(',').length > 0) {
      timerIndexCache.split(',').forEach(t => {
        this.timer.deleteTimer(t)
      })
    }

    // redis fact address map缓存 factId 自增
    if (rule) {
      const { factIds } = this._ruleFormat(JSON.parse(rule))
      if (opt.pub && factIds.length > 0) {
        await this._factAddrMap(factIds, -1)
      }
    }

    // 广播删除规则
    if (this.opt.pubSub && opt.pub) this.redisObj.publish('DELRULE', JSON.stringify({ name: ruleName }))
    console.log(`[EngineMain ${process.pid}] delete rule ${ruleName}`)
  }

  /**
   * 增加规则
   * @param  {String} ruleName 规则名称
   * @param  {Object} definition 规则的定义(参见测试代码)
   * @param  {object string} option 配置项
   * @param  {boolean} option.pub 同步到各个进程
   * @param  {boolean} option.cache 缓存到redis
   * @return {Array} 当前规则所需的 factId 数组
   */
  async addRule (ruleName, definition, option) {
    const opt = Object.assign({ pub: false, cache: true }, option)
    // add rule in JRN
    // 同名规则不重复创建，直接返回
    if (this.ruleMap.has(ruleName)) return 
    const { rule, timers, factIds } = this._ruleFormat(definition)

    super.addRule(rule)
    this.ruleNameArray.push(ruleName)
    this.ruleMap.set(ruleName, `${timers.map(t => t.id).join(',')}`)

    // save rule in redis
    if (opt.cache) await this.redis.hset(msg.RULEMAP, ruleName, JSON.stringify(definition))
    // 创建定时器
    if (this.runTimer) {
      timers.forEach(t => {
        this.timer.addTimer(t.id, t.rule, t.recurrence)
      })
    }
    // 广播增加规则
    if (this.opt.pubSub && opt.pub) {
      this.redisObj.publish('ADDRULE', JSON.stringify({
        name: ruleName,
        value: definition
      }))
    }

    // redis fact address map缓存 factId 自增
    // 主动广播的是主执行进程需操作redis，不广播的为收到信息同步操作进程不操作redis
    if (opt.pub) {
      await this._factAddrMap(factIds, 1)
    }

    console.log(`[EngineMain ${process.pid}] add rule ${ruleName}`)
    return factIds
  }

  /**
   * 增加fact
   * @param  {String} factId fact id（对应规则definition中的fact字段）
   * @param  {String} value fact的值
   * @param  {object string} option 配置项
   * @param  {boolean} option.pub 同步到各个进程
   * @param  {boolean} option.cache 缓存到rediss
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async addFact (factId, value, option) {
    const opt = Object.assign({ pub: false, cache: true }, option)

    // 查询是否是有效设定了rule的fact
    const isAvailable = await this.redis.hget(msg.FACTADDRMAP, factId)
    if (!isAvailable) return console.log(`[EngineMain] unused fact ${factId}`)

    // redis中存储fact值的类型，取出后转换
    if (opt.cache) await this.redis.hset(msg.FACTMAP, factId, `${JSON.stringify(value)}!${this._getType(value)}`)
    super.addFact(factId, value)

    // 广播增加fact
    if (this.opt.pubSub && opt.pub) this.redisObj.publish('ADDFACT', JSON.stringify({ [factId]: value }))
    console.log(`[EngineMain ${process.pid}] add fact ${factId}`)
  }

  /**
   * 清理runtime中的规则(不会清理缓存)
   */
  async clearRules () {
    super.clearRules()
    this.ruleMap.clear()
    this.ruleNameArray = []
    if (this.runTimer) this.timer.clear()
    await this.redis.del(msg.FACTADDRMAP)
    console.log(`[EngineMain ${process.pid}] clear`)
  }

  /**
   * 从redis缓存加载所有规则
   */
  async addRulesFromCache () {
    const rules = await this.redis.hgetall(msg.RULEMAP)
    Object.keys(rules).forEach(key => {
      this.addRule(key, JSON.parse(rules[key]), { cache: false })
    })
    console.log(`[EngineMain ${process.pid}] add rule from cache`)
  }

  /**
   * 从redis缓存加载所有fact
   */
  async addFactsFromCache () {
    const facts = await this.redis.hgetall(msg.FACTMAP)
    Object.keys(facts).forEach(key => {
      // 转换成真实数据类型的值
      const value = this._redisFactFormat(facts[key])
      this.addFact(key, value, { cache: false })
    })
    console.log(`[EngineMain ${process.pid}] add fact from cache`)
  }

  /**
   * Runs an array of rules
   * @param  {Rule[]} array of rules to be evaluated
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async run (event) {
    if (this.opt.updateFactBeforeRun) await this.addFactsFromCache()
    return super.run(event)
      .then(ret => {
        console.log(`fire rule ${JSON.stringify(ret)}`)
        return ret
      })
  }

  /**
   * 删除 runtime 中 规则 + 定时器 + redis cache
   * @param  {String} ruleName 规则名称
   * @param  {object string} option 配置项
   * @param  {boolean} option.pub 同步到各个进程
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  async stopRule (ruleName, option ) {
    const opt = Object.assign({ pub: false, cache: true }, option)
    const rule = await this.redis.hget(msg.RULEMAP, ruleName)

    const timerIndexCache = this.ruleMap.get(ruleName)
    const ruleIndexCache = this.ruleNameArray.indexOf(ruleName)

    // 删除 runtime 中rule
    super.removeRuleByIndex(ruleIndexCache)
    this.ruleMap.delete(ruleName)
    if (ruleIndexCache > -1) this.ruleNameArray.splice(ruleIndexCache, 1)

    // 删除定时器
    if (this.runTimer && timerIndexCache && timerIndexCache.split(',').length > 0) {
      timerIndexCache.split(',').forEach(t => {
        this.timer.deleteTimer(t)
      })
    }

    // redis fact address map缓存 factId 自增
    if (rule) {
      const { factIds } = this._ruleFormat(JSON.parse(rule))
      if (opt.pub && factIds.length > 0) {
        await this._factAddrMap(factIds, -1)
      }
    }

    // 广播删除规则
    if (this.opt.pubSub && opt.pub) this.redisObj.publish('STOPRULE', JSON.stringify({ name: ruleName }))

    console.log(`[EngineMain ${process.pid}] stop rule ${ruleName}`)
  }

  /**
   * 将规则格式化，拆分组合定时规则
   * @param  {Rule[]} array of rules to be evaluated
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  _ruleFormat (definition) {
    const { timers, conditions, event } = definition
    const factIds = []

    // 遍历conditions获取所有factId
    function traverse (arr) {
      // console.log('1111', JSON.stringify(arr))
      arr.forEach(each => {
        const keys = Object.keys(each)
        if (keys.length === 1 && ['all', 'any'].includes(keys[0])) {
          traverse(each[keys[0]]) 
        } else {
          factIds.push(each.fact)
        }
      })
    }
    Object.keys(conditions).forEach(key => {
      traverse(conditions[key])
    })

    if (!timers) return { rule: definition, timers: [], factIds }

    // 将定时 作为 true/false 加入json-rule
    // 条件定时器 直接加入json-rule的condition中
    // 限制定时器 与原有condition重新组合成all条件
    const conditionsKey = Object.keys(conditions)[0]
    const rules = conditions[conditionsKey]
    let limitTimer = null
    timers.forEach(t => {
      factIds.push(t.id)
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
      timers,
      factIds
    }
  }

  /**
   * 将redis中fact的值转换为对应类型的值
   * @param  {string} cacheValue redis hash 中存储的带数据类型的值
   * @return {any} 转换成对应的值
   */
  _redisFactFormat (cacheValue) {
    const fact = cacheValue.split('!')
    let ret = fact[0]
    switch (fact[1]) {
      case 'number':
        ret = ret * 1
        break
      case 'string':
        break
      case 'boolean':
        ret = ret === 'true'
        break
      case 'array' || 'object':
        ret = JSON.parse(ret)
      default:
        break
    }
    return ret
  }

  /**
   * 检测参数的数据类型
   * @param  {any} value 待检测数据类型的数据
   * @return {string} 小写的数据类型
   */
  _getType (value) {
    let ret = typeof value
    if (['number', 'string', 'boolean', 'undefined'].includes(ret)) return ret
    if (value instanceof Array) return 'array'
    if (value instanceof Object) return 'object'
  }

  /**
   * 更改fact address map 缓存
   * @param  {array} factIds factId 数组
   * @param  {number} inc 增量
   * @return {null}
   */
  _factAddrMap (factIds, inc) {
    const pipeline = this.redis.pipeline()
    factIds.forEach(id => {
      pipeline.hincrby(msg.FACTADDRMAP, id, inc)
    })
    return pipeline.exec()
  }
}

module.exports = Engine
