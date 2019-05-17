const Redis = require('ioredis')

const redisCli = new Redis()
const redisCli2 = new Redis()

async function main () {
  redisCli.subscribe('addRule', function (err, count) {
    console.log(count)

    redisCli2.publish('addRule', 'hello')
  })
  redisCli.on('message', function (channel, message) {
    console.log('Receive message %s from channel %s', message, channel);
  })
}

main()
.then(() => {})
.catch(err => {
  throw err
})