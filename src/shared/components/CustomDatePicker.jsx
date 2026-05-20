// CustomDatePicker.jsx — wrapper cho antd DatePicker với style VSLA
import { DatePicker } from 'antd'

export function CustomeStyleDatePicker(props) {
  return (
    <DatePicker
      style={{
        height: 50,
        width: '100%',
        fontFamily: 'Roboto, sans-serif',
        fontSize: 15,
        borderColor: '#E6E6E6',
      }}
      {...props}
    />
  )
}
