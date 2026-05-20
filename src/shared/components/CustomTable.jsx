// CustomTableAntd — wrapper cho antd Table với style VSLA
import { Table } from 'antd'

export function CustomTableAntd({ isHighlighted, rowClassName, ...props }) {
  return (
    <Table
      size="middle"
      rowClassName={rowClassName}
      pagination={false}
      {...props}
    />
  )
}
