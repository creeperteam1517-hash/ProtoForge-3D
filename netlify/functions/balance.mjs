import { handleBalance } from '../../server/handlers.js'
import { json, lowerHeaders, initBlobs } from '../../server/http.js'

export const handler = async (event) => {
  initBlobs(event)
  const { status, json: body } = await handleBalance(lowerHeaders(event.headers))
  return json(status, body)
}
