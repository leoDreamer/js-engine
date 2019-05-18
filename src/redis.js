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
    this.subClient = this.getClient()
    this.pubClient = this.getClient()
  }

  get topicMap () {
    return {
      ADDRULE: 'ADDRULE',
      ADDFACT: 'ADDFACT',
      DELRULE: 'DELRULE'
    }
  }

  getClient () {
    const { config } = this
    return config.cluster
      ? new Ioredis.Cluster(config.nodes)
      : new Ioredis(config)
  }

  async subAll () {
    const _self = this
    this.subClient.on('message', function (channel, message) {
      console.log('Receive message %s from channel %s', message, channel)
      switch (channel) {
        case this.topicMap.ADDRULE:
          console.log(message)
          break;
        case this.topicMap.ADDFACT:
          break;
        case this.topicMap.DELRULE:
          break;
        default:
          break;
      }
    })
    return new Promise((resolve, reject) => {
      console.log(Object.keys(this.topicMap).join(','))
      this.subClient.subscribe(Object.keys(this.topicMap).join(','), function (err, count) {
        if (err) reject(err)
        _self.pubClient.publish('ADDRULE', 'hello world')
        console.log('111111', err, count)
        resolve()
      })
    })
  }

  publish (topic, message) {
    if (Object.keys(this.topicMap).includes(topic))
    console.log(`publish ${topic} ${message}`)
    this.pubClient.publish(topic, message)
  }
}

module.exports = Redis
