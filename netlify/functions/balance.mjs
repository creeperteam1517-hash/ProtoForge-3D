import { handleBalance } from '../../server/handlers.js'
import { json, lowerHeaders } from '../../server/http.js'

export const handler = async (event) => {
  const { status, json: body } = await handleBalance(lowerHeaders(event.headers))
  return json(status, body)
}
