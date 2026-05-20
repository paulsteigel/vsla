export const formatVN = (number) => {
  if (number === undefined || number === null) return '0'
  const num = Number(number)
  if (isNaN(num)) return '0'
  if (Number.isInteger(num)) return num.toLocaleString('vi-VN')
  return num.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const formatCurrency = (number) => `${formatVN(number)} ₫`
export const formatPercent = (number) => `${formatVN(number)}%`

export const buildParam = (filter) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value !== '' && value !== null && value !== undefined) params.append(key, value)
  }
  return params.toString()
}
