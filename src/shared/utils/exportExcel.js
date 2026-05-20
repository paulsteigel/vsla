// exportExcel.js — export báo cáo ra file Excel
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import dayjs from 'dayjs'

export const exportToExcelHighLight = async (columns, data, fileName, filters = {}) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Báo cáo')

  // Header info
  const fromDate = filters.fromDate ? dayjs(filters.fromDate).format('MM/YYYY') : ''
  const toDate = filters.toDate ? dayjs(filters.toDate).format('MM/YYYY') : ''
  const location = [filters.value, filters.valueComnune].filter(Boolean).join(' — ')

  worksheet.mergeCells('A1:E1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = fileName || 'Báo cáo VSLA'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4701E' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 30

  if (fromDate || toDate) {
    worksheet.mergeCells('A2:E2')
    const periodCell = worksheet.getCell('A2')
    periodCell.value = `Kỳ báo cáo: ${fromDate} — ${toDate}${location ? ' | ' + location : ''}`
    periodCell.font = { italic: true, color: { argb: 'FF484746' } }
    periodCell.alignment = { horizontal: 'center' }
  }

  // Column headers
  const headerRow = worksheet.addRow(columns.filter(c => c.dataIndex !== 'unitType').map(c => c.title))
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF28649' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE6E6E6' } } }
  })
  worksheet.getRow(3).height = 24

  // Data rows
  data.forEach((row) => {
    if (row.unitType === 'title') {
      const titleRow = worksheet.addRow([row.id, row.name, '', '', ''])
      titleRow.eachCell((cell) => {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4DE' } }
      })
    } else {
      worksheet.addRow([row.id, row.name, row.unitType, row.value, row.accumulatedValue])
    }
  })

  // Column widths
  worksheet.columns = [
    { width: 8 },
    { width: 45 },
    { width: 14 },
    { width: 20 },
    { width: 24 },
  ]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${fileName}_${fromDate}_${toDate}.xlsx`)
}
