import { handleSpend } from '../../server/handlers.js'
import { json, lowerHeaders, initBlobs } from '../../server/http.js'

export const handler = async (event) => {
  initBlobs(event)
  const { status, json: body } = await handleSpend(lowerHeaders(event.headers))
  return json(status, body)
}
