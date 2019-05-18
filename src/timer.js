const schedule = require('node-schedule')
const _ = require('lodash')

class Timer {
  constructor(engine) {
    this.engine = engine
    this.timers = new Map()
  }

  addTimer (name, rule, start, end) {
    // 同名timer不重复创建
    if (this.timers.has(name)) return
    const timer = schedule.scheduleJob(_.pickBy({ start, end, rule }), function(name, engine){
      engine.run({ [name]: true })
    }.bind(null, name, this.engine))
    this.timers.set(name, timer)
  }

  deleteTimer (name) {
    const timer = this.timers.get(name)
    if (timer) timer.cancel()
    this.timers.delete(name)
  }

  clear () {
    this.timers.values(t => {
      t.cancel()
    })
    this.timers.clear()
  }
}

module.exports = Timer
