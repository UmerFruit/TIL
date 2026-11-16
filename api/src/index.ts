import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import Database from "better-sqlite3"

const app = new Hono()

const db = new Database("../database/til.db")

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/api/challenges', (c) => {
    const challenges = db.prepare("select * from challenges").all()
    return c.json(challenges);
})

app.get('/api/progress', (c) => {
    const progress = db.prepare("select * from progress").all()
    return c.json(progress);
})


serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
