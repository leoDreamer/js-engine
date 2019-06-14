const Engine = require('../src/engine')

const engine = new Engine({
  runTimer: true, // 这个进程是否启动定时器
  pubSub: true,
  updateFactBeforeRun: false //每次run前是否从redis加载所有fact
})
engine.on('timer', (data) => {
  console.log(`engine on timer ${data}`)
  engine.run({ [data]: true })
})

async function sleep (time) {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log(`sleep ${time}s end`)
      resolve()
    }, time * 1000)
  })
}

function pubSubTest () {
  engine.redisObj.publish('DELRULE', JSON.stringify({name: 'test1'}))
  engine.redisObj.publish('ADDRULE', JSON.stringify({name: 'test1', value: {
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
        recurrence: { // 时间段触发
          range: ['8:00', '13:00'],
          dayofWeek: [0 ,1 ,2, 3, 4, 5, 6], // Starting with Sunday
        }
      }
    ]
  }}))
}

async function addRule () {
  engine.addRule('test1', {
    conditions: {
      all: [{
          fact: `s2`,
          operator: 'equal',
          value: true,
          path: '.test'
        },{
          fact: `s3`,
          operator: 'equal',
          value: true
        }]
    },
    event: {
      type: `scence-emit`,
      params: { id: 'test2' }
    },
    timers: [
      {
        id: 's124',
        type: 'CONDITION',
        recurrence: { // 时间段触发
          range: ['01:00', '23:59'],
          dayofWeek: [0 ,1 ,2, 3, 4, 5, 6], // Starting with Sunday
        },
        // rule: '0 34 16 ? * Wed *' // dayofDay触发
        // rule: '0 36 16 29 5 * 2019' // 时间点触发
      }
    ]
  }, { pub: true })
}

// 简单使用
async function simpleTest () {
  await addRule()

  await engine.addFact('s3', true)
  await engine.addFact('s2', { test: true })

  return engine.run()
}

async function main () {
  await simpleTest() // console out: fire rule [{"type":"scence-emit","params":{"id":"test1"}}]
  await sleep(6)
  await engine.deleteRule('test1', { pub: true }) // stop console
  await sleep(6) // sleep 4s end
  await addRule() // console fire agine
  await sleep(70) // sleep 4s end
  await engine.stopRule('test', { pub: true })
  await engine.clearRules() // fire rule []
}
main()
