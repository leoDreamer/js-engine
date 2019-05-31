const Ioredis = require('ioredis')
const assert = require('assert')

class Redis {
  constructor(config = {}, engine) {
    this.config = config.client || {
      port: 6379,
      host: '127.0.0.1',
      password: '',
      db: 0
    }
    this.engine = engine
    this.subClient = this._getClient()
    this.pubClient = this._getClient()
    this.pid = process.pid
  }

  get topicMap () {
    return {
      ADDRULE: 'ADDRULE',
      ADDFACT: 'ADDFACT',
      DELRULE: 'DELRULE',
      STOPRULE: 'STOPRULE'
    }
  }

  get client () {
    return this.pubClient
  }

  _getClient () {
    const { config } = this
    return config.cluster
      ? new Ioredis.Cluster(config.nodes)
      : new Ioredis(config)
  }

  async subAll () {
    const _self = this
    this.subClient.on('message', async function (channel, message) {
      console.log('[EngineSub] Receive message %s from channel %s', message, channel)
      const msg = JSON.parse(message)
      // 本进程的pub不做sub处理
      if (msg.pid + '' === process.pid + '') return
      delete msg.pid
      switch (channel) {
        case _self.topicMap.ADDRULE:
          assert(msg.name && msg.value, console.error(`[EngineSub] illegal ADDURLE param ${message}`))
          await _self.engine.addRule(msg.name, msg.value, { pub: false, cache: false })
          break;
        case _self.topicMap.ADDFACT:
          assert(msg.name && msg.value, console.error(`[EngineSub] illegal ADDFACT param ${message}`))
          const key = Object.keys(msg)[0]
          await _self.engine.addFact(key, msg[key], { pub: false, cache: false })
          break;
        case _self.topicMap.DELRULE:
          assert(msg.name, console.error(`[EngineSub] illegal DELRULE param ${message}`))
          await _self.engine.deleteRule(msg.name, { pub: false, cache: false })
          break;
        case _self.topicMap.STOPRULE:
          assert(msg.name, console.error(`[EngineSub] illegal STOPRULE param ${message}`))
          await _self.engine.stopRule(msg.name, { pub: false })
          break;
        default:
          break;
      }
    })
    return new Promise((resolve, reject) => {
      this.subClient.subscribe('ADDRULE','ADDFACT', 'DELRULE', 'STOPRULE', function (err, count) {
        _self.subed = true
        if (err) reject(err)
        resolve()
      })
    })
  }

  publish (topic, message) {
    let msg = null
    if (!Object.keys(this.topicMap).includes(topic)) return console.error(`[Enginepub] illegal topic ${topic}`)
    try {
      msg = JSON.parse(message)
    } catch (err) {
      console.error(`[Enginepub] illegal message should be JSON string ${topic}`)
    }
    console.log(`[EnginePub] ${topic} ${message}`)
    this.pubClient.publish(topic, JSON.stringify(Object.assign(msg, { pid: this.pid })))
  }
}

module.exports = Redis
