import { handleCreateCheckout } from '../../server/handlers.js'
import { json, lowerHeaders, parseBody, initBlobs } from '../../server/http.js'

export const handler = async (event) => {
  initBlobs(event)
  const { status, json: body } = await handleCreateCheckout(
    lowerHeaders(event.headers),
    parseBody(event)
  )
  return json(status, body)
}
