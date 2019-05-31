const Redis = require('../src/redis')

const redis = new Redis()

async function main() {
  await redis.subAll()
  await redis.publish('ADDRULE', JSON.stringify({ msg: 'hello world' }))
}

main()