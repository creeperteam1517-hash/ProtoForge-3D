import { handleMe } from '../../server/handlers.js'
import { json, lowerHeaders } from '../../server/http.js'

export const handler = async (event) => {
  const { status, json: body } = await handleMe(lowerHeaders(event.headers))
  return json(status, body)
}
