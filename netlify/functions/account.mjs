import { handleAccount } from '../../server/handlers.js'
import { json } from '../../server/http.js'

export const handler = async () => {
  const { status, json: body } = await handleAccount()
  return json(status, body)
}
