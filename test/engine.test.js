const Redis = require('ioredis')
const Engine = require('../src/engine')

const redisCli = new Redis()


const engine = new Engine(redisCli, {
  runTimer: true, // 这个进程是否启动定时器
  updateFactBeforeRun: true //每次run前是否从redis加载所有fact
})

async function sleep (time) {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log(`sleep ${time}s end`)
      resolve()
    }, time * 1000)
  })
}

async function addFact () {
  engine.addRule('test1', {
    conditions: {
      all: [{
          fact: `s2`,
          operator: 'equal',
          value: true
        },{
          fact: `s3`,
          operator: 'equal',
          value: true
        }]
    },
    event: {
      type: `scence-emit`,
      params: { id: 'test1' }
    },
    timers: [
      {
        id: 's124',
        type: 'CONDITION',
        range: ['* 1 0 * * *', '* 59 23 * * *'],
        rule: '*/1 * * * * *'
      }
    ]
  })
}

// 简单使用
async function simpleTest () {
  await addFact()

  await engine.addFact('s3', true)
  await engine.addFact('s2', true)

  return engine.run()
}

async function main () {
  await simpleTest() // console out: fire rule [{"type":"scence-emit","params":{"id":"test1"}}]
  await engine.deleteRule('test1') // stop console
  await sleep(4) // sleep 4s end
  await addFact() // console fire agine
  await sleep(4) // sleep 4s end
  engine.clearRules() // fire rule []
}
main()

