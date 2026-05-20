import { httpAuth } from './http'

export const fetchAPIOrganize = {
  getAllOrganizebyCustomer: async (id) =>
    await httpAuth.get(`/customers/${id}/organizations`),
}
