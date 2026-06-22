import { handleMe } from '../../server/handlers.js'
import { json, lowerHeaders, initBlobs } from '../../server/http.js'

export const handler = async (event) => {
  initBlobs(event)
  const { status, json: body } = await handleMe(lowerHeaders(event.headers))
  return json(status, body)
}
