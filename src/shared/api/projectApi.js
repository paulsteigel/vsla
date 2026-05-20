import { httpAuth } from './http'

export const fetchAPIProject = {
  getProjectbyCustomer: async (id, organizationId = '') => {
    let url = `/customers/${id}/projects`
    if (organizationId) url += `?organizationId=${organizationId}`
    return await httpAuth.get(url)
  },
}
