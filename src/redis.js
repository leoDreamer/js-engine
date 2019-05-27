const Ioredis = require('ioredis')

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
    this.subClient.on('message', function (channel, message) {
      console.log('[EngineSub] Receive message %s from channel %s', message, channel)
      switch (channel) {
        case _self.topicMap.ADDRULE:
          const rule = JSON.parse(message)
          _self.engine.addRule(rule.name, rule.value, { pub: false })
          break;
        case _self.topicMap.ADDFACT:
          const fact = JSON.parse(message, { pub: false })
          const key = Object.keys(fact)[0]
          _self.engine.addFact(key, fact[key])
          break;
        case _self.topicMap.DELRULE:
          _self.engine.deleteRule(message, { pub: false })
          break;
        case _self.topicMap.STOPRULE:
            _self.engine.stopRule(message, { pub: false })
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
    if (Object.keys(this.topicMap).includes(topic))
    console.log(`[EnginePub] ${topic} ${message}`)
    this.pubClient.publish(topic, message)
  }
}

module.exports = Redis
