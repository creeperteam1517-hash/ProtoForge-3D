import { handleAccount } from '../../server/handlers.js'
import { json, initBlobs } from '../../server/http.js'

export const handler = async (event) => {
  initBlobs(event)
  const { status, json: body } = await handleAccount()
  return json(status, body)
}
