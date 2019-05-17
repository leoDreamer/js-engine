const schedule = require('node-schedule')

class Timer {
  constructor(engine) {
    this.engine = engine
    this.timers = new Map()
  }

  addTimer (name, rule, start, end) {
    const timer = schedule.scheduleJob({ start, end, rule }, function(name){
      console.log(`Time for tea - ${x}`);
    }.bind(null, name))
    this.timers.set(name, timer)
  }

  deleteTimer (name) {
    const timer = this.timers.get(name)
    if (timer) timer.cancel()
    this.timers.delete(name)
  }
}

module.exports = Timer
