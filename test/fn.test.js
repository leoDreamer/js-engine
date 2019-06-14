const Engine = require('../src/engine')
const assert = require('assert')

const engine = new Engine()

function testRuleFormat () {
  const ret = engine._ruleFormat({
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
    ],
    conditions: {
      any: [{
        all: [{
          fact: 'gameDuration',
          operator: 'equal',
          value: 40
        }, {
          fact: 'personalFoulCount',
          operator: 'greaterThanInclusive',
          value: 5
        }]
      }, {
        all: [{
          fact: 'gameDuration',
          operator: 'equal',
          value: 48
        }, {
          fact: 'personalFoulCount',
          operator: 'greaterThanInclusive',
          value: 6
        }]
      }]
    }    
  })
  assert(ret.factIds.length === 5, 'rule format get factIds error')
}

testRuleFormat()
