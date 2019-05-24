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
    console.log(`${name}-${rule}`)
    // 同名timer不重复创建
    if (this.timers.has(name)) return

    const callBack = function(name, engine){
      console.log(`[Timer Trigger]: ${name}`)
      engine.run({ [name]: true })
    }.bind(null, name, this.engine)

    let timer 
    if (recurrence) {
      const { range, dayofWeek } = recurrence
      const start = range[0].split(':')
      const end = range[1].split(':')
      timer = this.getRecurrence(name, start[0], start[1], end[0], end[1], dayofWeek, callBack)
    } else {
      timer = schedule.scheduleJob(rule, callBack)
    }
    console.log(`[Timer Add]: ${name}`)
    this.timers.set(name, timer)
  }

  // 是用嵌套任务每天增加时间段内任务
  getRecurrence (name, startH, startM, endH, endM, dayOfWeek, callBack) {
    const today = moment().format('YYYY-MM-DD')
    console.log(`${this._parseNum(startH)}:${this._parseNum(startM)}:${this._parseNum(endH)}:${this._parseNum(endM)}`)
    const timeConfig = {
      start: moment(`${today} ${this._parseNum(startH)}:${this._parseNum(startM)}:00`),
      end: moment(`${today} ${this._parseNum(endH)}:${this._parseNum(endM)}:00`),
      rule: `${parseInt(Math.random() * 10000 % 59)} */1 * * * *`,
    }
    console.log(JSON.stringify(timeConfig))


    console.log(`[Nest Timer Add]: ${name}`)
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
    this.timers.delete(name)
  }

  clear () {
    this.timers.values(t => {
      t.cancel()
    })
    this.timers.clear()
  }

  // 将一位(数字/字符)转成两位，满足moment格式要求
  _parseNum (num) {
    return parseInt(num) < 10
      ? (parseInt(num) === 0 ? '00' :'0' + num)
      : num
  }
}

module.exports = Timer
