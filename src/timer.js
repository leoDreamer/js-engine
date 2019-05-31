const schedule = require('node-schedule')
const _ = require('lodash')
const moment = require('moment')

class Timer {
  constructor(engine) {
    this.engine = engine
    this.timers = new Map()
    this.nestTimers = new Map()
  }

  addTimer (name, rule, recurrence) {
    // 同名timer不重复创建
    if (this.timers.has(name)) return

    const callBack = function(name, engine){
      console.log(`[EngineTimerTrigger]: ${name}`)
      engine.emit('timer', name)
    }.bind(null, name, this.engine)

    let timer 
    if (recurrence) {
      const { range, dayofWeek } = recurrence
      const start = range[0].split(':')
      const end = range[1].split(':')
      timer = this.getRecurrence(name, start[0], start[1], end[0], end[1], dayofWeek, callBack)
    } else {
      let formatRule = rule
      const ruleArr = rule.split(' ')
      if (ruleArr.length === 7) {
        // 7位cron表达式格式化成6位
        if (ruleArr[6] === '*') {
          // dayofweek 重复
          ruleArr.pop()
          formatRule = ruleArr.join(' ')
        } else {
          // 固定时间点
          formatRule = new Date(ruleArr[6], ruleArr[4] - 1, ruleArr[3], ruleArr[2], ruleArr[1], ruleArr[0])
        }

      }
      timer = schedule.scheduleJob(formatRule, callBack)
    }
    console.log(`[EngineTimerAdd]: ${name}`)
    this.timers.set(name, timer)
  }

  // 是用嵌套任务每天增加时间段内任务
  getRecurrence (name, startH, startM, endH, endM, dayOfWeek, callBack) {
    const today = moment().format('YYYY-MM-DD')
    const timeConfig = {
      start: moment(`${today} ${this._parseNum(startH)}:${this._parseNum(startM)}:00`),
      end: moment(`${today} ${this._parseNum(endH)}:${this._parseNum(endM)}:00`),
      rule: `${parseInt(Math.random() * 10000 % 59)} */1 * * * *`,
    }

    console.log(`[EngineNestTimerAdd]: ${name}`)
    // 添加当天的定时器
    this.nestTimers.set(name, schedule.scheduleJob(timeConfig, callBack))
    // 定时器 map 中添加外层定时器
    return schedule.scheduleJob(`${parseInt(Math.random() * 10000 % 59)} 0 0 */1 * ${dayOfWeek.join(',')}`, function (_self) {
      _self.nestTimers.set(name, schedule.scheduleJob(timeConfig, callBack))
    }.bind(null, this))
  }

  deleteTimer (name) {
    const timer = this.timers.get(name)
    if (timer) timer.cancel()
    const nestTimer = this.nestTimers.get(name)
    if (nestTimer) nestTimer.cancel()
    this.timers.delete(name)
    console.log(`[EngineTimerDel]: ${name}`)
  }

  clear () {
    this.timers.values(t => {
      t.cancel()
    })
    this.timers.clear()
    console.log(`[EngineTimerClear]`)
  }

  // 将一位(数字/字符)转成两位，满足moment格式要求
  _parseNum (num) {
    if ((num + '').length === 2) return num
    return parseInt(num) < 10
      ? (parseInt(num) === 0 ? '00' :'0' + num)
      : num
  }
}

module.exports = Timer
