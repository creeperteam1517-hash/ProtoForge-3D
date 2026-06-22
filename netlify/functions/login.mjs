import { handleLogin } from '../../server/handlers.js'
import { json, lowerHeaders, parseBody, initBlobs } from '../../server/http.js'

export const handler = async (event) => {
  initBlobs(event)
  const { status, json: body } = await handleLogin(
    lowerHeaders(event.headers),
    parseBody(event)
  )
  return json(status, body)
}
