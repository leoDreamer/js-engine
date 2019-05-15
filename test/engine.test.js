const Redis = require('ioredis')
const Engine = require('../src/engine')

const redisCli = new Redis()

async function main () {
  const engine = new Engine(redisCli)

  await engine.addRule('test', {
    conditions: {
      all: [{
          fact: `s1`,
          operator: 'equal',
          value: true
        },{
          fact: `s2`,
          operator: 'equal',
          value: true
        }]
    },
    event: {
      type: `scence-emit`,
      params: { id: 1 }
    }
  })

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
      params: { id: 1 }
    },
    timers: [{
      id: 's123',
      type: 'LIMIT',
      range: ['* 45 3 * * *', '* 30 5 * * *'],
      rule: '*/30 * * * * *'
    }, {
      id: 's124',
      type: 'CONDITION',
      range: ['* 45 3 * * *', '* 30 5 * * *'],
      rule: '*/30 * * * * *'
    }]
  })

  await engine.addFact('s1', true)
  await engine.addFact('s2', true)

  // await engine.deleteRule('test1')

  engine.run({s2: true, s3: true})
    .then(resp => {
      console.log(`fire rule ${JSON.stringify(resp)}`)
    })
}

main().then(() => {
  redisCli.quit()
})
