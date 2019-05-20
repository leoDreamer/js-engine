const Engine = require('../src/engine')

const engine = new Engine({
  runTimer: true, // 这个进程是否启动定时器
  pubSub: true,
  updateFactBeforeRun: false //每次run前是否从redis加载所有fact
})

async function sleep (time) {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log(`sleep ${time}s end`)
      resolve()
    }, time * 1000)
  })
}

async function addRule () {
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
        // range: [],
        // rule: '0 32 19 * * *'
      }
    ]
  })
}

// 简单使用
async function simpleTest () {
  await addRule()

  await engine.addFact('s3', true)
  await engine.addFact('s2', true)

  return engine.run()
}

async function main () {
  await simpleTest() // console out: fire rule [{"type":"scence-emit","params":{"id":"test1"}}]
  await engine.deleteRule('test1') // stop console
  await sleep(4) // sleep 4s end
  await addRule() // console fire agine
  await sleep(4) // sleep 4s end
  engine.clearRules() // fire rule []
}
main()

