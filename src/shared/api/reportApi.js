import { httpAuth } from './http'

export const fetchAPIReport = {
  getReport: async ({ params }) =>
    await httpAuth.get(`/reports?reportType=overview_report_v2&${params}&_start=0&_end=100`),
}
