import { httpAuth } from './http'

export const fetchAPISearchAddress = {
  getApiSearch: async ({ params }) => {
    const { administrativeLevel, cityCode, wardCode } = params
    const first = await httpAuth.get(
      `/addresses?administrativeLevel=${administrativeLevel}&cityCode=${cityCode}&wardCode=${wardCode}&_start=0&_end=10`
    )
    const total = first?.payload?.total || 0
    const data = first?.payload?.data || []
    if (data.length >= total) return first
    return await httpAuth.get(
      `/addresses?administrativeLevel=${administrativeLevel}&cityCode=${cityCode}&wardCode=${wardCode}&_start=0&_end=${total}`
    )
  },
  getProvinceByCustomer: async (id, params = null) => {
    if (!params?.organizationId) return await httpAuth.get(`/customers/${id}/cities`)
    let url = `/customers/${id}/cities?organizationId=${params.organizationId}`
    if (params.projectId) url += `&projectId=${params.projectId}`
    return await httpAuth.get(url)
  },
}
