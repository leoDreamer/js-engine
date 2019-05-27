const Engine = require('../src/engine')

const engine = new Engine({
  runTimer: true, // 这个进程是否启动定时器
  pubSub: false
})

const opt = {
  rule: 20000
}

function getRandor (num) {
  return parseInt((Math.random() * 1000000) % num) + 1
}

async function run (id, value) {
  await engine.addFact(id, value, { pub: false })
  return  engine.run()
    .then(resp => {
      console.log(`run reslut: ${resp.length}`)
      resp = null
      // engine.removeFact(id)
    })
}

async function mulitRule () {
  const len = opt.rule
  const each = 50
  for(var i = 0; i < len / each; i++) {
    await Promise.all(new Array(each).fill(0).map((e, index) => {
      return engine.addRule(`scence${i * each + index}`, {
        conditions: {
          all: [{
              fact: `s${i * each + index}`,
              operator: 'equal',
              value: true
            },{
              fact: `s${i * each + index + 1}`,
              operator: 'equal',
              value: true
            }]
        },
        event: {
          type: 'scence',
          params: { id: i * each + index }
        },
        timers: [
          {
            id: `t${i * each + index}`,
            type: 'CONDITION',
            recurrence: { // 时间段触发
              range: ['1:00', '2:00'],
              dayofWeek: [0 ,1 ,2, 3, 4, 5, 6], // Starting with Sunday
            }
          }
        ]
      })
    }))
    console.log(`add rule ${i * each} ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`)
  }
}

async function batch () {
  console.time('addRule')
  await mulitRule()
  console.timeEnd('addRule')
  for (var i = 0; i < 20000; i++) {
    const id = `s${getRandor(opt.rule)}`
    console.time(id)
    await run(id, true)
    console.log(`add fact ${i} ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`)
    console.timeEnd(id)
  }
}

batch()
