// CustomSelect.jsx — wrapper nhẹ cho antd Select, giữ style nhất quán
import { Select } from 'antd'

const selectStyle = {
  height: 50,
  width: '100%',
  fontFamily: 'Roboto, sans-serif',
  fontSize: 15,
}

export function CustomSelect({ children, ...props }) {
  return (
    <Select style={selectStyle} {...props}>
      {children}
    </Select>
  )
}

export function CustomStyledSelect({ children, ...props }) {
  return (
    <Select
      style={selectStyle}
      {...props}
    >
      {children}
    </Select>
  )
}
