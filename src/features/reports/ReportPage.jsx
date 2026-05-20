/**
 * ReportVSLA.js
 *
 * CHANGE LOG:
 * -----------
 * [paulsteigel - 2026-05-20]
 *   BUG FIX — Province dropdown không hiện data:
 *     Dòng check điều kiện render dùng nhầm `projectOption.length`
 *     thay vì `provinceOpion.length` → dropdown tỉnh luôn rỗng.
 *
 *   BUG FIX — Date picker hiển thị ngày nhưng Java xử lý theo tháng:
 *     Java controller tự ép fromDate → đầu tháng, toDate → cuối tháng.
 *     Đổi picker sang picker="month" (format MM/YYYY) để UI đồng nhất
 *     với logic backend. Default: tháng trước → tháng hiện tại.
 *
 *   BUG FIX — ADMIN fetch ngay khi vào trang dù chưa chọn filter:
 *     fromDate/toDate mặc định đã có giá trị → hasSearchFilter = true
 *     → fetch toàn bộ data không có scope. Nay đổi sang nút bấm thủ công.
 *
 *   FEATURE — Tỉnh multi-select:
 *     Cho phép chọn nhiều tỉnh/thành phố cùng lúc.
 *     cityCode gửi lên API là chuỗi join bằng dấu phẩy.
 *     Java buildQuery() đã hỗ trợ IN clause khi value có dấu phẩy.
 *
 *   FEATURE — Xã multi-select với nhóm theo tỉnh:
 *     Cho phép chọn nhiều xã/phường. Khi chọn nhiều tỉnh, danh sách
 *     xã được nhóm (OptGroup) theo từng tỉnh để dễ phân biệt.
 *     wardCode gửi lên API là chuỗi join bằng dấy phẩy.
 *     SQL overview_report_v2.sql đã được đổi = → IN để hỗ trợ.
 *
 *   FEATURE — Nút "Xem báo cáo" thay cho auto-fetch:
 *     Tránh fetch tự động khi chưa đủ điều kiện filter.
 *     Nút bị disable khi chưa chọn đủ scope theo role.
 *     WARD_ADMIN vẫn auto-load vì filter đã đủ ngay từ đầu.
 *
 *   FEATURE — Nhãn kỳ báo cáo và địa bàn sau khi load:
 *     Hiển thị "Kỳ MM/YYYY" hoặc "Từ MM/YYYY đến MM/YYYY"
 *     cùng tên tỉnh/xã đã chọn để người dùng xác nhận đúng kỳ.
 *
 *   FEATURE — Export Excel chỉ hiện khi đã có data:
 *     Tránh export file rỗng gây nhầm lẫn.
 *
 *   BUG FIX — URL lỗi ?& trong getProvinceByCustomer:
 *     Đã fix trong apiSearchAddressRequest.js (cùng commit).
 */

import { Box } from "@mui/material"
import { Select } from "antd"
import dayjs from "dayjs"
import React, { useEffect, useMemo, useState, useCallback } from "react"
import { fetchAPIProject } from "@/shared/api/projectApi"
import { fetchAPIReport } from "@/shared/api/reportApi"
import { fetchAPISearchAddress } from "@/shared/api/addressApi"
import { exportToExcelHighLight } from "@/shared/utils/exportExcel"
import { buildParam } from "@/shared/utils/format"
import { CustomeStyleDatePicker } from "@/shared/components/CustomDatePicker"
import { CustomSelect, CustomStyledSelect } from "@/shared/components/CustomSelect"
import { CustomTableAntd } from "@/shared/components/CustomTable"
import { fetchAPIOrganize } from "@/shared/api/orgApi"

// [paulsteigel - 2026-05-20] Format số theo chuẩn Việt Nam:
// - Dấu . ngăn cách hàng nghìn (1.234.567)
// - Dấu , phần thập phân (1.234,56)
// - Số nguyên không hiện phần thập phân
// - % hiện 2 chữ số thập phân dùng dấu ,
const formatVN = (number) => {
  if (number === undefined || number === null) return "0"
  const num = Number(number)
  if (isNaN(num)) return "0"
  const isInteger = Number.isInteger(num)
  if (isInteger) {
    return num.toLocaleString("vi-VN")
  }
  // Số thập phân — dùng locale vi-VN tự động dùng dấu . và ,
  return num.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const { Option } = Select

// [paulsteigel - 2026-05-20]
// Mặc định từ đầu tháng trước → cuối tháng hiện tại.
// Java controller tự ép: fromDate → withDayOfMonth(1), toDate → lengthOfMonth()+1
// nên chỉ cần gửi đúng tháng, không cần tính ngày chính xác.
const defaultFromMonth = dayjs().subtract(1, "month").startOf("month")
const defaultToMonth = dayjs().endOf("month")

const columns = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    render: (text, record) =>
      record.unitType === "title" ? <span className="font-bold">{`${record.id}`}</span> : text
  },
  {
    title: "Thông tin",
    dataIndex: "name",
    key: "name",
    render: (text, record) =>
      record.unitType === "title" ? <span className="font-bold">{`${record.name}`}</span> : text
  },
  {
    title: "Đơn vị",
    dataIndex: "unitType",
    key: "unitType",
    align: "center",
    className: "text-center",
    render: (text, record) => (record.unitType === "title" ? null : text)
  },
  {
    title: "Số trong kỳ",
    dataIndex: "value",
    align: "right",
    key: "value",
    // [paulsteigel - 2026-05-20] Format chuẩn VN: dấu . nghìn, dấu , thập phân
    // Đồng → thêm đ, % → hiện 2 chữ số thập phân
    render: (text, record) => {
      if (record.unitType === "title") return null
      const formatted = formatVN(text)
      if (record.unitType === "Đồng") return `${formatted} ₫`
      if (record.unitType === "%") return `${formatted}%`
      return formatted
    },
    className: "text-center"
  },
  {
    title: "Số lũy kế đến cuối kỳ",
    dataIndex: "accumulatedValue",
    align: "right",
    key: "accumulatedValue",
    render: (text, record) => {
      if (record.unitType === "title") return null
      const formatted = formatVN(text)
      if (record.unitType === "Đồng") return `${formatted} ₫`
      if (record.unitType === "%") return `${formatted}%`
      return formatted
    },
    className: "text-center"
  }
]

// [paulsteigel - 2026-05-20] Tách suffixIcon ra ngoài để tái sử dụng, tránh tạo object mới mỗi render
const suffixIcon = (
  <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.6912 9.53055L13.1912 17.0306C13.1215 17.1003 13.0388 17.1556 12.9478 17.1933C12.8567 17.2311 12.7591 17.2505 12.6606 17.2505C12.562 17.2505 12.4644 17.2311 12.3734 17.1933C12.2823 17.1556 12.1996 17.1003 12.1299 17.0306L4.62995 9.53055C4.48922 9.38982 4.41016 9.19895 4.41016 8.99993C4.41016 8.80091 4.48922 8.61003 4.62995 8.4693C4.77068 8.32857 4.96155 8.24951 5.16057 8.24951C5.3596 8.24951 5.55047 8.32857 5.6912 8.4693L12.6606 15.4396L19.6299 8.4693C19.6996 8.39962 19.7824 8.34435 19.8734 8.30663C19.9644 8.26892 20.062 8.24951 20.1606 8.24951C20.2591 8.24951 20.3567 8.26892 20.4477 8.30663C20.5388 8.34435 20.6215 8.39962 20.6912 8.4693C20.7609 8.53899 20.8162 8.62171 20.8539 8.71276C20.8916 8.8038 20.911 8.90138 20.911 8.99993C20.911 9.09847 20.8916 9.19606 20.8539 9.2871C20.8162 9.37815 20.7609 9.46087 20.6912 9.53055Z"
      fill="#D2D2D2"
    />
  </svg>
)

const ReportVSLA = () => {
  const { infoUser, roleUser } = useAuthStore()
  

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  // [paulsteigel - 2026-05-20] Track trạng thái đã search chưa để kiểm soát
  // hiển thị table và nút export — tránh hiện table rỗng khi mới vào trang
  const [hasSearched, setHasSearched] = useState(false)

  // [paulsteigel - 2026-05-20]
  // fromDate/toDate gửi theo định dạng YYYY-MM-DD (ngày đầu/cuối tháng).
  // Java sẽ tự normalize về đầu/cuối tháng nên không cần tính chính xác ngày.
  // cityCode và wardCode là chuỗi join bằng dấu phẩy khi chọn nhiều.
  const [filter, setFilter] = useState({
    organizationId: "",
    projectId: "",
    fromDate: defaultFromMonth.format("YYYY-MM-DD"),
    toDate: defaultToMonth.format("YYYY-MM-DD"),
    cityCode: "",
    wardCode: ""
  })

  // Options cho các dropdown
  const [organizationOption, setOrganizationOption] = useState([])
  const [projectOption, setProjectOption] = useState([])
  const [provinceOptions, setProvinceOptions] = useState([])

  // [paulsteigel - 2026-05-20] Multi-select tỉnh: lưu riêng codes và names
  const [selectedCityCodes, setSelectedCityCodes] = useState([])
  const [selectedCityNames, setSelectedCityNames] = useState([])

  // [paulsteigel - 2026-05-20] Map commune theo cityCode để hỗ trợ lazy load
  // từng tỉnh khi user chọn nhiều tỉnh — tránh load tất cả một lúc
  const [communeMap, setCommuneMap] = useState({})
  const [selectedWardCodes, setSelectedWardCodes] = useState([])
  const [selectedWardNames, setSelectedWardNames] = useState([])
  const [loadingCommune, setLoadingCommune] = useState(false)

  const rowClassName = (record) => (record.unitType === "title" ? "title-row-high-light" : "")

  // ─── Loaders ──────────────────────────────────────────────────────────────

  const loadOrganizations = useCallback(async () => {
    const res = await fetchAPIOrganize.getAllOrganizebyCustomer(infoUser?.customerId)
    if (res?.status === 200) setOrganizationOption(res.payload.data)
  }, [infoUser?.customerId])

  const loadProjects = useCallback(async (organizationId = "") => {
    const res = await fetchAPIProject.getProjectbyCustomer(infoUser?.customerId, organizationId)
    if (res?.status === 200) setProjectOption(res.payload.data)
  }, [infoUser?.customerId])

  const loadProvinces = useCallback(async (organizationId, projectId) => {
    const res = await fetchAPISearchAddress.getProvinceByCustomer(infoUser?.customerId, {
      organizationId,
      projectId
    })
    if (res?.status === 200) setProvinceOptions(res.payload.data)
  }, [infoUser?.customerId])

  // [paulsteigel - 2026-05-20]
  // Lazy load commune theo từng cityCode — chỉ gọi API khi chưa có trong map.
  // Hỗ trợ multi-tỉnh: gọi lần lượt từng tỉnh chưa load.
  const loadCommunes = useCallback(async (cityCodes) => {
    if (!cityCodes.length) return
    setLoadingCommune(true)
    const newMap = { ...communeMap }
    for (const code of cityCodes) {
      if (newMap[code]) continue // đã cache rồi, bỏ qua
      const res = await fetchAPISearchAddress.getApiSearch({
        params: { administrativeLevel: 4, cityCode: code, wardCode: "" }
      })
      if (res?.status === 200) newMap[code] = res.payload.data
    }
    setCommuneMap(newMap)
    setLoadingCommune(false)
  }, [communeMap])

  // [paulsteigel - 2026-05-20]
  // Tổng hợp tất cả commune từ các tỉnh đã chọn để render dropdown xã
  const allCommunes = useMemo(() => {
    return selectedCityCodes.flatMap((code) => communeMap[code] || [])
  }, [selectedCityCodes, communeMap])

  // ─── Init theo role ───────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!infoUser) return
    loadOrganizations()

    if (["ORGANIZATION_ADMIN", "PROJECT_ADMIN", "CITY_ADMIN"].includes(infoUser.role) && roleUser?.organizationId) {
      const orgId = roleUser.organizationId
      const projId = roleUser.projectId === 0 ? "" : roleUser.projectId
      setFilter((prev) => ({ ...prev, organizationId: orgId, projectId: projId }))
      loadProjects(orgId)
      loadProvinces(orgId, projId)

      if (infoUser.role === "CITY_ADMIN" && roleUser.cityCode) {
        setSelectedCityCodes([roleUser.cityCode])
        setSelectedCityNames([roleUser.cityName])
        setFilter((prev) => ({ ...prev, cityCode: roleUser.cityCode }))
        loadCommunes([roleUser.cityCode])
      }
    } else if (infoUser.role === "WARD_ADMIN" && roleUser?.organizationId) {
      const orgId = roleUser.organizationId
      const projId = roleUser.projectId
      setFilter((prev) => ({
        ...prev,
        organizationId: orgId,
        projectId: projId,
        cityCode: roleUser.cityCode,
        wardCode: roleUser.wardCode
      }))
      setSelectedCityCodes([roleUser.cityCode])
      setSelectedCityNames([roleUser.cityName || roleUser.cityCode])
      setSelectedWardCodes([roleUser.wardCode])
      setSelectedWardNames([roleUser.wardName])
      setCommuneMap({ [roleUser.cityCode]: [{ wardCode: roleUser.wardCode, name: roleUser.wardName }] })
      loadProjects(orgId)
      loadProvinces(orgId, projId)
    } else if (infoUser.role === "ADMIN") {
      loadProjects()
    }
  }, [roleUser, infoUser])

  // ─── Handlers filter ──────────────────────────────────────────────────────

  const resetAddress = () => {
    setProvinceOptions([])
    setSelectedCityCodes([])
    setSelectedCityNames([])
    setCommuneMap({})
    setSelectedWardCodes([])
    setSelectedWardNames([])
    setFilter((prev) => ({ ...prev, cityCode: "", wardCode: "" }))
  }

  const handleOrgChange = (orgId) => {
    resetAddress()
    setFilter((prev) => ({ ...prev, organizationId: orgId, projectId: "" }))
    loadProjects(orgId)
    if (orgId) loadProvinces(orgId, "")
    else setProvinceOptions([])
    setHasSearched(false)
  }

  const handleProjectChange = (projId) => {
    resetAddress()
    setFilter((prev) => ({ ...prev, projectId: projId }))
    if (filter.organizationId) loadProvinces(filter.organizationId, projId)
    setHasSearched(false)
  }

  // [paulsteigel - 2026-05-20]
  // codes là array cityCode từ multi-select antd.
  // Load commune cho các tỉnh mới chọn, reset xã khi đổi tỉnh.
  const handleCityChange = async (codes) => {
    const names = codes.map((c) => {
      const found = provinceOptions.find((p) => p.cityCode === c)
      return found ? found.name : c
    })
    setSelectedCityCodes(codes)
    setSelectedCityNames(names)
    // Reset xã vì tỉnh đã thay đổi
    setSelectedWardCodes([])
    setSelectedWardNames([])
    setFilter((prev) => ({ ...prev, cityCode: codes.join(","), wardCode: "" }))
    await loadCommunes(codes)
    setHasSearched(false)
  }

  // [paulsteigel - 2026-05-20]
  // wardCode gửi lên API join bằng dấu phẩy.
  // Java ReportRepository.buildQuery() tự split và build IN ('w1','w2','w3').
  // SQL overview_report_v2.sql đã đổi = {{wardCode}} → IN ({{wardCode}}).
  const handleWardChange = (codes) => {
    const names = codes.map((c) => {
      const found = allCommunes.find((w) => w.wardCode === c)
      return found ? found.name : c
    })
    setSelectedWardCodes(codes)
    setSelectedWardNames(names)
    setFilter((prev) => ({ ...prev, wardCode: codes.join(",") }))
    setHasSearched(false)
  }

  // ─── Fetch report ─────────────────────────────────────────────────────────

  // [paulsteigel - 2026-05-20]
  // Đổi từ auto-fetch (useEffect theo filter) sang fetch thủ công qua nút bấm.
  // Lý do: auto-fetch gây query toàn bộ data khi mới vào trang (fromDate/toDate
  // mặc định đã có giá trị → hasSearchFilter = true dù chưa chọn scope).
  const handleViewReport = async () => {
    const queryParam = buildParam(filter)
    setLoading(true)
    const res = await fetchAPIReport.getReport({ params: queryParam })
    if (res?.status === 200) {
      setData(res.payload.data)
      setHasSearched(true)
    }
    setLoading(false)
  }

  // [paulsteigel - 2026-05-20]
  // WARD_ADMIN: filter đã đủ ngay từ khi init (wardCode được set từ roleUser)
  // nên auto-load luôn, không cần bấm nút.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (infoUser.role === "WARD_ADMIN" && filter.wardCode) {
      handleViewReport()
    }
  }, [filter.wardCode, infoUser.role])

  const uniqueData = useMemo(() => {
    return data.map((item, index) => ({ ...item, uniqueKey: `${item.id}-${index}` }))
  }, [data])

  // ─── Export Excel ─────────────────────────────────────────────────────────

  const handleExportToExcel = () => {
    // [paulsteigel - 2026-05-20]
    // exportToExcelHighLight dùng { value, valueComnune, valueDistrict } để
    // render header địa phương trong file Excel.
    // Truyền tên đầy đủ của các tỉnh/xã đã chọn.
    const filters = {
      ...filter,
      value: selectedCityNames.join(", "),
      valueComnune: selectedWardNames.join(", "),
      valueDistrict: ""
    }
    exportToExcelHighLight(columns, data, "Báo cáo VSLA", filters)
  }

  // ─── Điều kiện cho phép bấm Xem báo cáo ─────────────────────────────────

  // [paulsteigel - 2026-05-20]
  // Mỗi role chỉ được query khi đã có đủ scope tối thiểu.
  // Tránh ADMIN query toàn bộ data không có filter.
  const canSearch = useMemo(() => {
    if (infoUser.role === "ADMIN") return !!(filter.organizationId || filter.projectId || filter.cityCode)
    if (infoUser.role === "ORGANIZATION_ADMIN") return !!filter.organizationId
    if (infoUser.role === "PROJECT_ADMIN") return !!filter.projectId
    if (infoUser.role === "CITY_ADMIN") return !!filter.cityCode
    if (infoUser.role === "WARD_ADMIN") return !!filter.wardCode
    return false
  }, [filter, infoUser.role])

  // [paulsteigel - 2026-05-20] Nhãn kỳ theo chuẩn VN: "Tháng 4/2026" thay vì "04/2026"
  const periodLabel = useMemo(() => {
    if (!filter.fromDate || !filter.toDate) return ""
    const from = dayjs(filter.fromDate).startOf("month")
    const to = dayjs(filter.toDate).endOf("month")
    const fromStr = `Tháng ${from.format("M/YYYY")}`
    const toStr = `Tháng ${to.format("M/YYYY")}`
    return from.isSame(to, "month") ? `Kỳ ${fromStr}` : `Từ ${fromStr} đến ${toStr}`
  }, [filter.fromDate, filter.toDate])

  // ─── Render helpers ───────────────────────────────────────────────────────

  // [paulsteigel - 2026-05-20] Kiểm tra field có bị lock theo role không
  const isReadOnly = (role, field) => {
    if (field === "org")     return ["ORGANIZATION_ADMIN", "PROJECT_ADMIN", "CITY_ADMIN", "WARD_ADMIN"].includes(role)
    if (field === "project") return ["PROJECT_ADMIN", "CITY_ADMIN", "WARD_ADMIN"].includes(role)
    if (field === "city")    return ["CITY_ADMIN", "WARD_ADMIN"].includes(role)
    if (field === "ward")    return role === "WARD_ADMIN"
    return false
  }

  const ReadOnlyBox = ({ value }) => (
    <div className="flex h-[50px] cursor-not-allowed select-none items-center truncate rounded border border-light-gray bg-gray-50 px-3 font-inter text-[15px] text-gray-500">
      {value || "Đang tải..."}
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full rounded-[1.4rem] font-popi">
      <Box className="w-full rounded-[1.4rem] bg-white p-[1.5rem]">

        {/* ── Row 1: Tổ chức / Dự án / Từ tháng / Đến tháng ── */}
        <div className="mb-4 flex w-full flex-wrap items-end gap-x-6 gap-y-3">

          {/* Tổ chức */}
          <div className="flex w-[220px] flex-col gap-y-1">
            <label className="text-[14px] font-[500] text-gray-700">Tổ chức</label>
            {isReadOnly(infoUser.role, "org") ? (
              <ReadOnlyBox
                value={(() => {
                  const org = organizationOption.find((o) => o.id === filter.organizationId)
                  return org ? `${org.shortName} - ${org.name}` : "Đang tải..."
                })()}
              />
            ) : (
              <CustomSelect onChange={handleOrgChange} value={filter.organizationId} placeholder="Chọn tổ chức">
                <Option value="">Tất cả</Option>
                {organizationOption.map((o, i) => (
                  <Option key={i} value={o.id}>{`${o.shortName} - ${o.name}`}</Option>
                ))}
              </CustomSelect>
            )}
          </div>

          {/* Dự án */}
          <div className="flex w-[220px] flex-col gap-y-1">
            <label className="text-[14px] font-[500] text-gray-700">Dự án</label>
            {isReadOnly(infoUser.role, "project") ? (
              <ReadOnlyBox
                value={(() => {
                  const p = projectOption.find((p) => p.id === filter.projectId)
                  return p ? `${p.shortName} - ${p.name}` : "Đang tải..."
                })()}
              />
            ) : (
              <CustomSelect
                onChange={handleProjectChange}
                value={filter.projectId}
                placeholder="Chọn dự án"
                disabled={!filter.organizationId && infoUser.role === "ADMIN"}
              >
                <Option value="">Tất cả</Option>
                {projectOption.map((p, i) => (
                  <Option key={i} value={p.id}>{`${p.shortName} - ${p.name}`}</Option>
                ))}
              </CustomSelect>
            )}
          </div>

          {/* [paulsteigel - 2026-05-20]
              Đổi từ DatePicker ngày sang picker="month".
              Java controller xử lý: fromDate.withDayOfMonth(1).atStartOfDay()
              nên chọn ngày nào trong tháng kết quả vẫn như nhau — dùng month
              picker cho rõ ràng với người dùng.
              disabledDate ngăn chọn fromDate sau toDate. */}
          <div className="flex w-[170px] flex-col gap-y-1">
            <label className="text-[14px] font-[500] text-gray-700">Từ tháng</label>
            <CustomeStyleDatePicker
              picker="month"
              format="MM/YYYY"
              value={filter.fromDate ? dayjs(filter.fromDate, "YYYY-MM-DD") : null}
              onChange={(date) =>
                setFilter((prev) => ({
                  ...prev,
                  fromDate: date ? date.startOf("month").format("YYYY-MM-DD") : ""
                }))
              }
              placeholder="Chọn tháng"
              disabledDate={(current) =>
                filter.toDate ? current && current.isAfter(dayjs(filter.toDate), "month") : false
              }
            />
          </div>

          <div className="flex w-[170px] flex-col gap-y-1">
            <label className="text-[14px] font-[500] text-gray-700">Đến tháng</label>
            <CustomeStyleDatePicker
              picker="month"
              format="MM/YYYY"
              value={filter.toDate ? dayjs(filter.toDate, "YYYY-MM-DD") : null}
              onChange={(date) =>
                setFilter((prev) => ({
                  ...prev,
                  toDate: date ? date.endOf("month").format("YYYY-MM-DD") : ""
                }))
              }
              placeholder="Chọn tháng"
              disabledDate={(current) =>
                filter.fromDate ? current && current.isBefore(dayjs(filter.fromDate), "month") : false
              }
            />
          </div>
        </div>

        {/* ── Row 2: Tỉnh (multi) / Xã (multi) / Nút xem / Export ── */}
        <div className="mb-6 flex w-full flex-wrap items-end gap-x-6 gap-y-3">

          {/* [paulsteigel - 2026-05-20]
              Tỉnh đổi thành multi-select. Value là array cityCode.
              Sau khi chọn: load commune cho các tỉnh mới, reset xã. */}
          <div className="flex w-[280px] flex-col gap-y-1">
            <label className="text-[14px] font-[500] text-gray-700">Tỉnh / Thành phố</label>
            {isReadOnly(infoUser.role, "city") ? (
              <ReadOnlyBox value={selectedCityNames.join(", ") || roleUser?.cityName} />
            ) : (
              <CustomStyledSelect
                mode="multiple"
                showSearch
                allowClear
                maxTagCount="responsive"
                placeholder="Chọn tỉnh (có thể chọn nhiều)"
                value={selectedCityCodes}
                suffixIcon={suffixIcon}
                filterOption={(input, option) =>
                  option.children
                    ?.normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .includes(input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
                }
                notFoundContent="Không tìm thấy tỉnh"
                onChange={handleCityChange}
                onClear={() => handleCityChange([])}
                disabled={!filter.organizationId && infoUser.role === "ADMIN"}
              >
                {/* [paulsteigel - 2026-05-20]
                    FIX: dùng provinceOptions.length thay vì projectOption.length
                    (bug cũ: check nhầm array nên dropdown luôn rỗng) */}
                {provinceOptions.map((p, i) => (
                  <Option key={i} value={p.cityCode}>
                    {p.name}
                  </Option>
                ))}
              </CustomStyledSelect>
            )}
          </div>

          {/* [paulsteigel - 2026-05-20]
              Xã đổi thành multi-select. Khi chọn nhiều tỉnh, danh sách xã
              được nhóm theo OptGroup từng tỉnh để dễ phân biệt.
              Disabled khi chưa chọn tỉnh hoặc đang load commune. */}
          <div className="flex w-[280px] flex-col gap-y-1">
            <label className="text-[14px] font-[500] text-gray-700">
              Xã / Phường
              {loadingCommune && (
                <span className="ml-2 text-[12px] text-gray-400">Đang tải...</span>
              )}
            </label>
            {isReadOnly(infoUser.role, "ward") ? (
              <ReadOnlyBox value={roleUser?.wardName} />
            ) : (
              <CustomStyledSelect
                mode="multiple"
                showSearch
                allowClear
                maxTagCount="responsive"
                placeholder={
                  selectedCityCodes.length === 0
                    ? "Chọn tỉnh trước"
                    : "Chọn xã / phường (có thể chọn nhiều)"
                }
                value={selectedWardCodes}
                suffixIcon={suffixIcon}
                disabled={selectedCityCodes.length === 0 || loadingCommune}
                filterOption={(input, option) =>
                  option.children
                    ?.normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .includes(input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
                }
                notFoundContent="Không tìm thấy xã"
                onChange={handleWardChange}
                onClear={() => handleWardChange([])}
              >
                {selectedCityCodes.length > 1
                  ? selectedCityCodes.map((cityCode) => {
                      const cityName = selectedCityNames[selectedCityCodes.indexOf(cityCode)]
                      const communes = communeMap[cityCode] || []
                      if (!communes.length) return null
                      return (
                        <Select.OptGroup key={cityCode} label={cityName}>
                          {communes.map((c, i) => (
                            <Option key={`${cityCode}-${i}`} value={c.wardCode}>
                              {c.name}
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )
                    })
                  : allCommunes.map((c, i) => (
                      <Option key={i} value={c.wardCode}>
                        {c.name}
                      </Option>
                    ))}
              </CustomStyledSelect>
            )}
          </div>

          {/* [paulsteigel - 2026-05-20]
              Nút Xem báo cáo thay cho auto-fetch.
              Disabled khi chưa đủ điều kiện theo role (xem canSearch).
              Hiện spinner khi đang loading. */}
          <div className="flex flex-col gap-y-1">
            <label className="text-[14px] font-[500] text-transparent select-none">.</label>
            <button
              onClick={handleViewReport}
              disabled={!canSearch || loading}
              className={`flex h-[50px] items-center gap-x-2 rounded-lg px-5 text-[15px] font-[500] transition-all duration-200 ${
                canSearch && !loading
                  ? "bg-orange-bg text-white hover:opacity-90 cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Đang tải...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Xem báo cáo
                </>
              )}
            </button>
          </div>

          {/* [paulsteigel - 2026-05-20]
              Export chỉ hiện khi đã có data — tránh export file rỗng */}
          {hasSearched && data.length > 0 && (
            <div className="flex flex-col gap-y-1">
              <label className="text-[14px] font-[500] text-transparent select-none">.</label>
              <Box
                className="flex h-[50px] cursor-pointer items-center gap-x-2 rounded-md border-[1px] border-main-text bg-transparent px-4 hover:opacity-80 transition-all"
                onClick={handleExportToExcel}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <path d="M5 2H15L20 7V21C20 21.2652 19.8946 21.5196 19.7071 21.7071C19.5196 21.8946 19.2652 22 19 22H5C4.73478 22 4.48043 21.8946 4.29289 21.7071C4.10536 21.5196 4 21.2652 4 21V3C4 2.73478 4.10536 2.48043 4.29289 2.29289C4.48043 2.10536 4.73478 2 5 2Z"
                    stroke="#F28649" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M14.5 9H9.5V17H14.5M14.5 13H9.5"
                    stroke="#F28649" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-main-text text-[15px]">Tải Excel</span>
              </Box>
            </div>
          )}
        </div>

        {/* [paulsteigel - 2026-05-20] Nhãn kỳ + địa bàn sau khi search */}
        {hasSearched && (
          <div className="mb-4 flex items-center gap-x-3 flex-wrap gap-y-2">
            <span className="rounded-md bg-orange-100 px-3 py-1 text-[13px] font-[500] text-orange-bg">
              {periodLabel}
            </span>
            {selectedCityNames.length > 0 && (
              <span className="rounded-md bg-gray-100 px-3 py-1 text-[13px] text-gray-600">
                {selectedCityNames.join(", ")}
                {selectedWardNames.length > 0 && ` — ${selectedWardNames.join(", ")}`}
              </span>
            )}
            <span className="text-[13px] text-gray-400">{data.length} chỉ số</span>
          </div>
        )}

        {/* Placeholder hướng dẫn khi chưa search */}
        {!hasSearched && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-30">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="text-[15px]">
              Chọn bộ lọc và bấm{" "}
              <strong className="text-orange-bg">Xem báo cáo</strong>
            </p>
          </div>
        )}

        {/* Table — chỉ render khi đã search hoặc đang loading */}
        {(hasSearched || loading) && (
          <CustomTableAntd
            columns={columns}
            dataSource={uniqueData}
            rowKey="uniqueKey"
            rowClassName={rowClassName}
            pagination={false}
            isHighlighted={true}
            loading={loading}
          />
        )}
      </Box>
    </div>
  )
}

export default ReportVSLA
