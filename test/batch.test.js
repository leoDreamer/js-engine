const Redis = require('ioredis')
const Engine = require('../src/engine')

const redisCli = new Redis()

const engine = new Engine({
  runTimer: true, // 这个进程是否启动定时器
  pubSub: true
})

const opt = {
  rule: 1000
}

function getRandor (num) {
  return parseInt((Math.random() * 1000000) % num) + 1
}

async function run (id, value) {
  await engine.addFact(id, value, { cache: false })
  return  engine.run()
    .then(resp => {
      console.log(`run reslut: ${resp.length}`)
      resp = null
      // engine.removeFact(id)
    })
}

async function mulitFact () {
  const len = opt.rule
  for(var i = 0; i < len; i++) {
    await engine.addRule(`scence${i}`, {
      conditions: {
        all: [{
            fact: `s${i}`,
            operator: 'equal',
            value: true
          },{
            fact: `s${i + 1}`,
            operator: 'equal',
            value: true
          }]
      },
      event: {
        type: 'scence',
        params: { i }
      },
      timers: [
        {
          id: 's124',
          type: 'CONDITION',
          range: ['* 50 23 * * *', '* 59 23 * * *'],
          rule: '* */1 * * * *'
          // range: [],
          // rule: '0 32 19 * * *'
        }
      ]
    })
  }
}

async function batch () {
  console.time('addRule')
  await mulitFact()
  console.timeEnd('addRule')
  for (var i = 0; i < 10000; i++) {
    const id = `s${getRandor(opt.rule)}`
    console.time(id)
    await run(id, true)
    console.timeEnd(id)
  }
}

batch().then(() => {
  redisCli.quit()
})
