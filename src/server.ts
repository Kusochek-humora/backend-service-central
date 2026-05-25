import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/', async () => {
  return { message: 'yan pedik' }
})

app.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})
