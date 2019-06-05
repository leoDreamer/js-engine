const Ioredis = require('ioredis')
const assert = require('assert')
const Queue = require('promise-queue-plus')

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
    this.promiseQueue = Queue(1, {
      autoRun:true
    })
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
      const msg = JSON.parse(message)
      // 本进程的pub不做sub处理
      if (msg.pid + '' === process.pid + '') return
      console.log(`[EngineSub ${_self.pid}] Receive message ${message} from channel ${channel}`)
      delete msg.pid
      switch (channel) {
        case _self.topicMap.ADDRULE:
          assert(msg.name && msg.value, `[EngineSub ${_self.pid}] illegal ADDURLE param ${message}`)
          _self.promiseQueue.push(_self.engine.addRule.bind(_self.engine, msg.name, msg.value, { pub: false, cache: false }))
          break;
        case _self.topicMap.ADDFACT:
          const key = Object.keys(msg)[0]
          assert(key, `[EngineSub ${_self.pid}] illegal ADDFACT param ${message}`)
          _self.promiseQueue.push(_self.engine.addFact.bind(_self.engine, key, msg[key], { pub: false, cache: false }))
          break;
        case _self.topicMap.DELRULE:
          assert(msg.name, `[EngineSub ${_self.pid}] illegal DELRULE param ${message}`)
          _self.promiseQueue.push(_self.engine.deleteRule.bind(_self.engine, msg.name, { pub: false, cache: false }))
          break;
        case _self.topicMap.STOPRULE:
          assert(msg.name, `[EngineSub ${_self.pid}] illegal STOPRULE param ${message}`)
          _self.promiseQueue.push(_self.engine.stopRule.bind(_self.engine, msg.name, { pub: false }))
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
    if (!Object.keys(this.topicMap).includes(topic)) return console.error(`[Enginepub ${this.pid}] illegal topic ${topic}`)
    try {
      msg = JSON.parse(message)
    } catch (err) {
      console.error(`[Enginepub ${this.pid}] illegal message should be JSON string ${topic}`)
    }
    console.log(`[EnginePub ${this.pid}] ${topic} ${message}`)
    this.pubClient.publish(topic, JSON.stringify(Object.assign(msg, { pid: this.pid })))
  }
}

module.exports = Redis
