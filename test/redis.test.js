const Redis = require('../src/redis')

const redis = new Redis()

async function main() {
  await redis.subAll()
  redis.publish('ADDRULE', 'hello world')
}

main()