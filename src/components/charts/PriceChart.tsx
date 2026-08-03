"use client"

import * as React from "react"
import { CartesianGrid, Area, AreaChart, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts"
import { formatIDR } from "@/lib/utils"
import { Calendar, Maximize2, Minimize2 } from "lucide-react"

interface PriceChartProps {
  data: { date: string; price: number }[];
  color: string;
}

const CustomYAxisBadge = (props: any) => {
  const { viewBox, fill, labelText, orientation } = props
  if (!viewBox) return null
  const { x, width, y } = viewBox
  
  const badgeWidth = 62
  const badgeHeight = 18
  
  const isRight = orientation === "right"
  const xPos = isRight ? (x + width) : x
  
  const drawX = isRight ? (xPos + 2) : (xPos - badgeWidth - 2)
  
  return (
    <g>
      <rect
        x={drawX}
        y={y - badgeHeight / 2}
        width={badgeWidth}
        height={badgeHeight}
        rx={3}
        fill={fill || "#089981"}
      />
      <text
        x={drawX + badgeWidth / 2}
        y={y + 3.5}
        fill="#fff"
        fontSize={10}
        fontWeight="bold"
        textAnchor="middle"
      >
        {labelText}
      </text>
    </g>
  )
}

const CustomYAxisLabelLeft = (props: any) => {
  const { viewBox, text, orientation } = props
  if (!viewBox) return null
  const { x, width, y } = viewBox
  
  const boxWidth = 56
  const boxHeight = 16
  
  const isRight = orientation === "right"
  const xPos = isRight ? (x + width) : x
  
  const drawX = isRight ? (xPos - boxWidth - 5) : (xPos + 5)
  
  return (
    <g>
      <rect
        x={drawX}
        y={y - boxHeight / 2}
        width={boxWidth}
        height={boxHeight}
        rx={2}
        fill="#787b86"
      />
      <text
        x={drawX + boxWidth / 2}
        y={y + 3.5}
        fill="#fff"
        fontSize={9}
        fontWeight="600"
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  )
}

export default function PriceChart({ data, color }: PriceChartProps) {
  const [activeChart, setActiveChart] = React.useState<"price">("price")
  const [timeframe, setTimeframe] = React.useState<"1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All">("1Y")
  const [showCustomRange, setShowCustomRange] = React.useState(false)
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false)
      }
    }
    if (isFullscreen) {
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  // Format data for time-scale X-axis and sort by time to prevent rendering glitches
  const timeframeData = React.useMemo(() => {
    if (data.length === 0) return []

    // Sort original data by date first
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (!showCustomRange && timeframe === "1D") {
      // Generate 24 hourly data points for the last day
      const latestPoint = sorted[sorted.length - 1]
      const latestPrice = latestPoint?.price ?? 0
      const baseTime = new Date().getTime() - 24 * 60 * 60 * 1000 // 24 hours ago
      
      const hourlyData = []
      let currentPrice = latestPrice * 0.99
      for (let i = 0; i <= 24; i++) {
        const time = baseTime + i * 60 * 60 * 1000
        const change = (Math.random() - 0.5) * 0.002
        currentPrice = currentPrice * (1 + change)
        
        hourlyData.push({
          time,
          price: Number(currentPrice.toFixed(4)),
        })
      }
      return hourlyData
    }

    let filtered = sorted
    const now = new Date()

    if (showCustomRange) {
      if (startDate) {
        const start = new Date(startDate)
        filtered = filtered.filter(d => new Date(d.date) >= start)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        filtered = filtered.filter(d => new Date(d.date) <= end)
      }
    } else {
      if (timeframe === "5D") {
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
        filtered = sorted.filter(d => new Date(d.date) >= fiveDaysAgo)
      } else if (timeframe === "1M") {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        filtered = sorted.filter(d => new Date(d.date) >= oneMonthAgo)
      } else if (timeframe === "3M") {
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        filtered = sorted.filter(d => new Date(d.date) >= threeMonthsAgo)
      } else if (timeframe === "6M") {
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        filtered = sorted.filter(d => new Date(d.date) >= sixMonthsAgo)
      } else if (timeframe === "YTD") {
        const jan1st = new Date(now.getFullYear(), 0, 1)
        filtered = sorted.filter(d => new Date(d.date) >= jan1st)
      } else if (timeframe === "1Y") {
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        filtered = sorted.filter(d => new Date(d.date) >= oneYearAgo)
      } else if (timeframe === "5Y") {
        const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
        filtered = sorted.filter(d => new Date(d.date) >= fiveYearsAgo)
      }
    }

    return filtered.map((d) => ({
      time: new Date(d.date).getTime(),
      price: d.price,
    }))
  }, [data, timeframe, showCustomRange, startDate, endDate])

  const [zoomStart, setZoomStart] = React.useState<number | null>(null)
  const [zoomEnd, setZoomEnd] = React.useState<number | null>(null)

  // Reset zoom on timeframe or criteria changes
  React.useEffect(() => {
    setZoomStart(null)
    setZoomEnd(null)
  }, [timeframe, showCustomRange, startDate, endDate, data])

  const chartData = React.useMemo(() => {
    const start = zoomStart ?? 0
    const end = zoomEnd ?? (timeframeData.length - 1)
    return timeframeData.slice(Math.max(0, start), Math.min(timeframeData.length, end + 1))
  }, [timeframeData, zoomStart, zoomEnd])

  // Drag & scroll state refs
  const dragStart = React.useRef<{ x: number; startIdx: number; endIdx: number } | null>(null)
  const touchStart = React.useRef<{ x1: number; x2: number | null; dist: number | null; startIdx: number; endIdx: number } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  // Wheel Zoom
  const handleWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const start = zoomStart ?? 0
    const end = zoomEnd ?? (timeframeData.length - 1)
    const currentLen = end - start + 1
    if (currentLen <= 0) return

    const factor = 0.05
    const delta = e.deltaY > 0 ? 1 : -1 // scroll down = zoom out, scroll up = zoom in
    
    // Calculate new number of elements changing by at least 1 index point
    let change = Math.round(currentLen * factor)
    if (change === 0) change = 1
    
    let newLen = currentLen + delta * change
    if (newLen < 5) newLen = 5
    if (newLen > timeframeData.length) newLen = timeframeData.length

    if (newLen === currentLen) return

    const diff = newLen - currentLen
    let newStart = start - Math.floor(diff / 2)
    let newEnd = end + Math.ceil(diff / 2)

    if (newStart < 0) {
      newStart = 0
      newEnd = newLen - 1
    }
    if (newEnd >= timeframeData.length) {
      newEnd = timeframeData.length - 1
      newStart = newEnd - newLen + 1
    }

    newStart = Math.max(0, newStart)
    newEnd = Math.min(timeframeData.length - 1, newEnd)

    setZoomStart(newStart)
    setZoomEnd(newEnd)
  }, [timeframeData, zoomStart, zoomEnd])

  // Mouse Drag to Scroll/Pan
  const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return // Left click only
    const start = zoomStart ?? 0
    const end = zoomEnd ?? (timeframeData.length - 1)
    dragStart.current = {
      x: e.clientX,
      startIdx: start,
      endIdx: end,
    }
    setIsDragging(true)
    document.body.style.userSelect = "none"
  }, [zoomStart, zoomEnd, timeframeData])

  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    if (Math.abs(dx) < 1) return

    const containerWidth = e.currentTarget.clientWidth || 500
    const dataLength = timeframeData.length
    
    const start = zoomStart ?? 0
    const end = zoomEnd ?? (dataLength - 1)
    const currentLen = end - start + 1

    const shift = Math.round((dx / containerWidth) * currentLen * 1.5)
    if (shift === 0) return

    let newStart = start - shift
    let newEnd = end - shift

    if (newStart < 0) {
      newStart = 0
      newEnd = currentLen - 1
    }
    if (newEnd >= dataLength) {
      newEnd = dataLength - 1
      newStart = newEnd - currentLen + 1
    }

    setZoomStart(newStart)
    setZoomEnd(newEnd)
    
    // Update reference pointer to track relative delta movements
    dragStart.current.x = e.clientX
  }, [timeframeData, zoomStart, zoomEnd])

  const handleMouseUpOrLeave = React.useCallback(() => {
    dragStart.current = null
    setIsDragging(false)
    document.body.style.userSelect = ""
  }, [])

  // Touch Zoom and Pan for Mobile
  const handleTouchStart = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const start = zoomStart ?? 0
    const end = zoomEnd ?? (timeframeData.length - 1)

    if (e.touches.length === 1) {
      touchStart.current = {
        x1: e.touches[0].clientX,
        x2: null,
        dist: null,
        startIdx: start,
        endIdx: end,
      }
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchStart.current = {
        x1: e.touches[0].clientX,
        x2: e.touches[1].clientX,
        dist: dist,
        startIdx: start,
        endIdx: end,
      }
    }
  }, [zoomStart, zoomEnd, timeframeData])

  const handleTouchMove = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStart.current) return

    const dataLength = timeframeData.length
    const start = zoomStart ?? 0
    const end = zoomEnd ?? (dataLength - 1)
    const currentLen = end - start + 1

    if (e.touches.length === 1 && touchStart.current.x1) {
      const dx = e.touches[0].clientX - touchStart.current.x1
      if (Math.abs(dx) < 1) return

      const containerWidth = e.currentTarget.clientWidth || 300
      const shift = Math.round((dx / containerWidth) * currentLen * 1.5)
      if (shift === 0) return

      let newStart = start - shift
      let newEnd = end - shift

      if (newStart < 0) {
        newStart = 0
        newEnd = currentLen - 1
      }
      if (newEnd >= dataLength) {
        newEnd = dataLength - 1
        newStart = newEnd - currentLen + 1
      }

      setZoomStart(newStart)
      setZoomEnd(newEnd)
      
      touchStart.current.x1 = e.touches[0].clientX
    } else if (e.touches.length === 2 && touchStart.current.dist) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const ratio = touchStart.current.dist / currentDist
      
      let newLen = Math.round(currentLen * ratio)
      if (newLen < 5) newLen = 5
      if (newLen > dataLength) newLen = dataLength

      const diff = newLen - currentLen
      let newStart = start - Math.floor(diff / 2)
      let newEnd = end + Math.ceil(diff / 2)

      if (newStart < 0) {
        newStart = 0
        newEnd = newLen - 1
      }
      if (newEnd >= dataLength) {
        newEnd = dataLength - 1
        newStart = newEnd - newLen + 1
      }

      setZoomStart(newStart)
      setZoomEnd(newEnd)
      
      touchStart.current.dist = currentDist
      touchStart.current.x1 = e.touches[0].clientX
      touchStart.current.x2 = e.touches[1].clientX
    }
  }, [timeframeData, zoomStart, zoomEnd])

  const handleTouchEnd = React.useCallback(() => {
    touchStart.current = null
  }, [])

  const total = React.useMemo(
    () => ({
      price: data.length > 0 ? data[data.length - 1].price : 0,
    }),
    [data]
  )

  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const formatPriceYAxis = React.useCallback((value: number) => {
    if (value >= 1e12) {
      const formatted = (value / 1e12).toLocaleString("id-ID", { maximumFractionDigits: 2 })
      return `${formatted} T`
    }
    if (value >= 1e9) {
      const formatted = (value / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })
      return `${formatted} M`
    }
    
    if (value > 10000) {
      return Math.round(value).toLocaleString("id-ID")
    }
    if (value >= 100) {
      return value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    
    if (value === 0) return "0"
    const decimals = value < 1 ? 6 : 4
    return value.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }, [])

  const getReturnForTimeframe = React.useCallback((tf: "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All") => {
    if (data.length === 0) return null
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    let filtered = sorted
    const now = new Date()
    
    if (tf === "1D") {
      const latestPoint = sorted[sorted.length - 1]
      const latestPrice = latestPoint?.price ?? 0
      const startPrice = latestPrice * 0.99
      const endPrice = latestPrice
      return ((endPrice - startPrice) / startPrice) * 100
    }
    
    if (tf === "5D") {
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      filtered = sorted.filter(d => new Date(d.date) >= fiveDaysAgo)
    } else if (tf === "1M") {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      filtered = sorted.filter(d => new Date(d.date) >= oneMonthAgo)
    } else if (tf === "3M") {
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      filtered = sorted.filter(d => new Date(d.date) >= threeMonthsAgo)
    } else if (tf === "6M") {
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      filtered = sorted.filter(d => new Date(d.date) >= sixMonthsAgo)
    } else if (tf === "YTD") {
      const jan1st = new Date(now.getFullYear(), 0, 1)
      filtered = sorted.filter(d => new Date(d.date) >= jan1st)
    } else if (tf === "1Y") {
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      filtered = sorted.filter(d => new Date(d.date) >= oneYearAgo)
    } else if (tf === "5Y") {
      const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
      filtered = sorted.filter(d => new Date(d.date) >= fiveYearsAgo)
    }
    
    if (filtered.length < 2) return null
    const startPrice = filtered[0].price
    const endPrice = filtered[filtered.length - 1].price
    return ((endPrice - startPrice) / startPrice) * 100
  }, [data])

  const xAxisTicks = React.useMemo(() => {
    if (chartData.length === 0) return []
    const totalPoints = chartData.length

    if (showCustomRange) {
      const maxTicks = isMobile ? 5 : 8
      const step = Math.max(1, Math.floor(totalPoints / (maxTicks - 1)))
      const ticks = []
      for (let i = 0; i < totalPoints; i += step) {
        ticks.push(chartData[i].time)
      }
      if (ticks[ticks.length - 1] !== chartData[totalPoints - 1].time) {
        ticks.push(chartData[totalPoints - 1].time)
      }
      return ticks
    }

    if (timeframe === "1D") {
      const step = isMobile ? 6 : 2 // 6 hours on mobile, 2 hours on desktop
      const ticks = []
      for (let i = 0; i < totalPoints; i += step) {
        ticks.push(chartData[i].time)
      }
      if (!ticks.includes(chartData[0].time)) {
        ticks.unshift(chartData[0].time)
      }
      if (!ticks.includes(chartData[totalPoints - 1].time)) {
        ticks.push(chartData[totalPoints - 1].time)
      }
      return Array.from(new Set(ticks)).sort()
    }

    if (timeframe === "5D") {
      const ticks = []
      let lastDay = -1
      for (let i = 0; i < totalPoints; i++) {
        const date = new Date(chartData[i].time)
        const day = date.getDay()
        const hour = date.getHours()
        
        if (day !== lastDay) {
          ticks.push(chartData[i].time)
          lastDay = day
        } else if (!isMobile && hour >= 13 && hour <= 14) {
          ticks.push(chartData[i].time)
        }
      }
      
      const lastTime = chartData[totalPoints - 1].time
      if (!ticks.includes(lastTime)) {
        ticks.push(lastTime)
      }
      
      if (isMobile && ticks.length > 5) {
        const step = Math.ceil(ticks.length / 5)
        const sampled = []
        for (let i = 0; i < ticks.length; i += step) {
          sampled.push(ticks[i])
        }
        if (!sampled.includes(lastTime)) {
          sampled.push(lastTime)
        }
        return Array.from(new Set(sampled)).sort()
      }
      
      return Array.from(new Set(ticks)).sort()
    }

    if (timeframe === "1M") {
      const stepDays = isMobile ? 14 : 7
      const ticks = []
      let lastTime = 0
      for (let i = 0; i < totalPoints; i++) {
        if (i === 0 || (chartData[i].time - lastTime) >= stepDays * 24 * 60 * 60 * 1000) {
          ticks.push(chartData[i].time)
          lastTime = chartData[i].time
        }
      }
      const lastTimeVal = chartData[totalPoints - 1].time
      if (!ticks.includes(lastTimeVal)) {
        ticks.push(lastTimeVal)
      }
      return Array.from(new Set(ticks)).sort()
    }

    if (timeframe === "3M" || timeframe === "YTD") {
      const step = isMobile ? 30 : 15
      const ticks = []
      for (let i = 0; i < totalPoints; i += step) {
        ticks.push(chartData[i].time)
      }
      const lastTimeVal = chartData[totalPoints - 1].time
      if (!ticks.includes(lastTimeVal)) {
        ticks.push(lastTimeVal)
      }
      return Array.from(new Set(ticks)).sort()
    }

    if (timeframe === "6M" || timeframe === "1Y") {
      const ticks = []
      let lastMonth = -1
      const interval = timeframe === "6M" ? 1 : 2
      
      let monthsSeen = 0
      for (let i = 0; i < totalPoints; i++) {
        const date = new Date(chartData[i].time)
        const month = date.getMonth()
        if (month !== lastMonth) {
          if (monthsSeen % interval === 0) {
            ticks.push(chartData[i].time)
          }
          lastMonth = month
          monthsSeen++
        }
      }
      
      const lastTimeVal = chartData[totalPoints - 1].time
      if (!ticks.includes(lastTimeVal)) {
        ticks.push(lastTimeVal)
      }
      
      if (isMobile && ticks.length > 5) {
        const step = Math.ceil(ticks.length / 5)
        const sampled = []
        for (let i = 0; i < ticks.length; i += step) {
          sampled.push(ticks[i])
        }
        if (!sampled.includes(lastTimeVal)) {
          sampled.push(lastTimeVal)
        }
        return Array.from(new Set(sampled)).sort()
      }
      
      return Array.from(new Set(ticks)).sort()
    }

    if (timeframe === "5Y" || timeframe === "All") {
      const ticks = []
      let lastYear = -1
      for (let i = 0; i < totalPoints; i++) {
        const year = new Date(chartData[i].time).getFullYear()
        if (year !== lastYear) {
          ticks.push(chartData[i].time)
          lastYear = year
        }
      }
      const lastTimeVal = chartData[totalPoints - 1].time
      if (!ticks.includes(lastTimeVal)) {
        ticks.push(lastTimeVal)
      }
      
      if (isMobile && ticks.length > 5) {
        const step = Math.ceil(ticks.length / 5)
        const sampled = []
        for (let i = 0; i < ticks.length; i += step) {
          sampled.push(ticks[i])
        }
        if (!sampled.includes(lastTimeVal)) {
          sampled.push(lastTimeVal)
        }
        return Array.from(new Set(sampled)).sort()
      }
      
      return Array.from(new Set(ticks)).sort()
    }

    const step = Math.ceil(totalPoints / (isMobile ? 5 : 8))
    const ticks = []
    for (let i = 0; i < totalPoints; i += step) {
      ticks.push(chartData[i].time)
    }
    if (ticks[ticks.length - 1] !== chartData[totalPoints - 1].time) {
      ticks.push(chartData[totalPoints - 1].time)
    }
    return ticks
  }, [chartData, timeframe, isMobile, showCustomRange, startDate, endDate])

  const formatXAxisLabel = React.useCallback((value: number, index?: number) => {
    const date = new Date(value)
    
    if (showCustomRange) {
      return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
    }

    if (index === undefined || index === null) {
      return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
    }

    const prevValue = index > 0 ? xAxisTicks[index - 1] : null
    const prevDate = prevValue ? new Date(prevValue) : null

    if (timeframe === "1D" || timeframe === "5D") {
      // If calendar day changed compared to previous tick, return day of month (e.g. "15")
      if (prevDate && date.getDate() !== prevDate.getDate()) {
        return date.getDate().toString()
      }
      
      const hh = String(date.getHours()).padStart(2, "0")
      const mm = String(date.getMinutes()).padStart(2, "0")
      return `${hh}:${mm}`
    }

    if (timeframe === "1M" || timeframe === "3M" || timeframe === "6M") {
      // If month changed, return month name (e.g. "Jul")
      if (prevDate && date.getMonth() !== prevDate.getMonth()) {
        return date.toLocaleDateString("en-US", { month: "short" })
      }
      // If first tick, show month name
      if (index === 0) {
        return date.toLocaleDateString("en-US", { month: "short" })
      }
      return date.getDate().toString()
    }

    if (timeframe === "YTD" || timeframe === "1Y") {
      // If year changed, return year (e.g. "2026")
      if (prevDate && date.getFullYear() !== prevDate.getFullYear()) {
        return date.getFullYear().toString()
      }
      // If month changed, return month name
      if (prevDate && date.getMonth() !== prevDate.getMonth()) {
        return date.toLocaleDateString("en-US", { month: "short" })
      }
      // If first tick, show year
      if (index === 0) {
        return date.getFullYear().toString()
      }
      return date.getDate().toString()
    }

    if (timeframe === "5Y" || timeframe === "All") {
      if (prevDate && date.getFullYear() !== prevDate.getFullYear()) {
        return date.getFullYear().toString()
      }
      if (index === 0) {
        return date.getFullYear().toString()
      }
      return date.getFullYear().toString()
    }

    return date.toLocaleDateString("id-ID", { month: "short", day: "numeric" })
  }, [timeframe, showCustomRange, xAxisTicks])

  if (data.length === 0) {
    return (
      <div className="card" style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--text-muted))" }}>
        Belum ada data harga historis
      </div>
    )
  }

  const minPrice = Math.min(...chartData.map((d) => d.price))
  const maxPrice = Math.max(...chartData.map((d) => d.price))
  const padding = (maxPrice - minPrice) * 0.1

  return (
    <div className="flex flex-col gap-3">
      {/* Main Chart Card */}
      <div className="card py-4 sm:py-0 overflow-hidden bg-white">
        <div className="flex flex-col border-b border-[hsl(var(--border))] sm:flex-row items-stretch justify-between p-0">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4">
            <h3 className="font-bold text-lg text-[hsl(var(--text-primary))] flex items-center gap-2">
              Grafik Harga Historis
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Perbesar ke Layar Penuh"
              >
                <Maximize2 size={15} />
              </button>
            </h3>
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              Menampilkan pergerakan harga aset
            </p>
          </div>
          <div className="flex">
            <button
              data-active={activeChart === "price"}
              className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left border-t border-[hsl(var(--border))] sm:border-t-0 sm:border-l sm:px-8 sm:py-6 bg-[hsl(var(--bg-base))] data-[active=true]:bg-[rgba(0,0,0,0.02)] transition-colors"
              onClick={() => setActiveChart("price")}
            >
              <span className="text-xs text-[hsl(var(--text-muted))]">
                Harga Terakhir
              </span>
              <span className="text-lg leading-none font-bold sm:text-3xl text-[hsl(var(--text-primary))] truncate max-w-[200px]">
                {formatIDR(total.price)}
              </span>
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6 mt-2">
          <div 
            className="aspect-auto h-[180px] sm:h-[220px] w-full relative select-none touch-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm transition-all cursor-pointer"
              >
                <Maximize2 size={11} />
                <span>Full chart</span>
              </button>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: isMobile ? 10 : 0,
                  right: isMobile ? 0 : 20,
                  top: 10,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  ticks={xAxisTicks}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  stroke="hsl(var(--text-muted))"
                  tickFormatter={formatXAxisLabel}
                  tick={{ style: { fontSize: isMobile ? '10px' : '11px', fill: 'hsl(var(--text-muted))' } }}
                  label={{ value: "WIB", position: "insideBottomRight", offset: -5, style: { fontSize: '10px', fill: 'hsl(var(--text-muted))', fontWeight: 600 } }}
                />
                <YAxis 
                  domain={[Math.max(0, minPrice - padding), maxPrice + padding]}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  tickMargin={8}
                  stroke="hsl(var(--text-muted))"
                  tickFormatter={formatPriceYAxis}
                  width={isMobile ? 65 : 80}
                  orientation={isMobile ? "right" : "left"}
                  tick={{ style: { fontSize: isMobile ? '10px' : '11px', fill: 'hsl(var(--text-muted))' } }}
                  tickCount={8}
                />
                <Tooltip
                  cursor={{ stroke: color, strokeDasharray: '4 4', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const formattedDate = timeframe === "1D"
                        ? new Date(label!).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })
                        : new Date(label!).toLocaleDateString("id-ID", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                      return (
                        <div 
                          style={{
                            background: "rgba(255, 255, 255, 0.9)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(0, 0, 0, 0.08)",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div style={{ fontSize: "0.78rem", color: "hsl(var(--text-secondary))", marginBottom: 2, fontWeight: 500 }}>
                            {formattedDate}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: color }}>
                            {formatPriceYAxis(payload[0].value as number)}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  dataKey="price"
                  type="linear"
                  stroke={color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "#fff" }}
                />
                {chartData.length > 0 && (
                  <ReferenceLine
                    y={chartData[chartData.length - 1].price}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    label={
                      <CustomYAxisBadge 
                        fill={color} 
                        labelText={formatPriceYAxis(chartData[chartData.length - 1].price)} 
                        orientation={isMobile ? "right" : "left"} 
                      />
                    }
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Timeframe Selector Card */}
      <div className="card p-3 bg-white">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full">
          {(
            [
              { key: "1D", label: "1 day" },
              { key: "5D", label: "5 days" },
              { key: "1M", label: "1 month" },
              { key: "3M", label: "3 months" },
              { key: "6M", label: "6 months" },
              { key: "YTD", label: "Year to date" },
              { key: "1Y", label: "1 year" },
              { key: "5Y", label: "5 years" },
              { key: "All", label: "All time" },
            ] as const
          ).map((tf) => {
            const pct = getReturnForTimeframe(tf.key)
            const isSelected = !showCustomRange && timeframe === tf.key
            
            let pctText = "-"
            let pctColorClass = "text-slate-400"
            
            if (pct !== null) {
              const formatted = pct.toFixed(2) + "%"
              pctText = pct >= 0 ? `${formatted}` : `${formatted}`
              pctColorClass = pct >= 0 ? "text-[#089981]" : "text-[#f23645]"
            }
            
            return (
              <button
                key={tf.key}
                type="button"
                onClick={() => {
                  setShowCustomRange(false);
                  setStartDate("");
                  setEndDate("");
                  setTimeframe(tf.key);
                }}
                className={`flex flex-col items-center justify-center min-w-[80px] px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-50/50"
                }`}
              >
                <span className="text-xs leading-tight text-slate-700 font-semibold whitespace-nowrap">{tf.label}</span>
                <span className={`text-[11px] font-bold mt-0.5 ${pctColorClass}`}>{pctText}</span>
              </button>
            )
          })}

          <div className="h-5 w-[1px] bg-slate-200 mx-1 flex-shrink-0" />

          <button
            type="button"
            onClick={() => setShowCustomRange(!showCustomRange)}
            className={`p-1.5 rounded transition-all cursor-pointer flex-shrink-0 ${
              showCustomRange
                ? "text-sky-600 bg-sky-50"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
            title="Pilih rentang tanggal kustom"
          >
            <Calendar size={15} />
          </button>
        </div>

        {showCustomRange && (
          <div className="flex flex-wrap items-center gap-2 mt-3 p-2 bg-slate-50 rounded-lg animate-fade-in-up">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded border border-slate-200 px-1.5 py-0.5 bg-white outline-none focus:border-sky-500 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded border border-slate-200 px-1.5 py-0.5 bg-white outline-none focus:border-sky-500 text-xs"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-xs text-red-500 hover:underline cursor-pointer ml-1"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {isFullscreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            padding: "24px 32px",
          }}
          className="animate-fade-in-up"
        >
          {/* Fullscreen Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "hsl(var(--text-primary))" }}>
                  Grafik Harga Historis
                </h3>
                <span className="text-sm font-semibold text-[hsl(var(--text-secondary))]" style={{ color }}>
                  {formatIDR(total.price)}
                </span>
              </div>
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.85rem", marginTop: 4 }}>
                Menampilkan pergerakan harga aset dalam mode layar penuh (Tekan ESC untuk keluar)
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "hsl(var(--bg-base))",
                border: "1px solid hsl(var(--border))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                color: "hsl(var(--text-secondary))",
                transition: "all 0.2s",
              }}
              title="Keluar Layar Penuh"
            >
              <Minimize2 size={16} />
            </button>
          </div>

          {/* Timeframe Controls in Fullscreen */}
          <div className="flex flex-col gap-2 mt-2 w-full mb-6">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full">
              {(
                [
                  { key: "1D", label: "1 day" },
                  { key: "5D", label: "5 days" },
                  { key: "1M", label: "1 month" },
                  { key: "3M", label: "3 months" },
                  { key: "6M", label: "6 months" },
                  { key: "YTD", label: "Year to date" },
                  { key: "1Y", label: "1 year" },
                  { key: "5Y", label: "5 years" },
                  { key: "All", label: "All time" },
                ] as const
              ).map((tf) => {
                const pct = getReturnForTimeframe(tf.key)
                const isSelected = !showCustomRange && timeframe === tf.key
                
                let pctText = "-"
                let pctColorClass = "text-slate-400"
                
                if (pct !== null) {
                  const formatted = pct.toFixed(2) + "%"
                  pctText = pct >= 0 ? `${formatted}` : `${formatted}`
                  pctColorClass = pct >= 0 ? "text-[#089981]" : "text-[#f23645]"
                }
                
                return (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => {
                      setShowCustomRange(false);
                      setStartDate("");
                      setEndDate("");
                      setTimeframe(tf.key);
                    }}
                    className={`flex flex-col items-center justify-center min-w-[75px] px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "text-slate-600 hover:bg-slate-50/50"
                    }`}
                  >
                    <span className="text-[10px] leading-tight text-slate-700 font-medium whitespace-nowrap">{tf.label}</span>
                    <span className={`text-[9px] font-semibold mt-0.5 ${pctColorClass}`}>{pctText}</span>
                  </button>
                )
              })}

              <div className="h-5 w-[1px] bg-slate-200 mx-1 flex-shrink-0" />

              <button
                type="button"
                onClick={() => setShowCustomRange(!showCustomRange)}
                className={`p-1.5 rounded transition-all cursor-pointer flex-shrink-0 ${
                  showCustomRange
                    ? "text-sky-600 bg-sky-50"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title="Pilih rentang tanggal kustom"
              >
                <Calendar size={15} />
              </button>
            </div>
          </div>

          {/* Custom Date Inputs under Fullscreen Timeframe */}
          {showCustomRange && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 20, padding: 8, background: "hsl(var(--bg-base))", borderRadius: 8 }}>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded border border-slate-200 px-1.5 py-0.5 bg-white outline-none focus:border-sky-500 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded border border-slate-200 px-1.5 py-0.5 bg-white outline-none focus:border-sky-500 text-xs"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                  className="text-xs text-red-500 hover:underline cursor-pointer ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Fullscreen Chart Wrapper */}
          <div 
            style={{ flex: 1, minHeight: 0, width: "100%", marginTop: 10 }}
            className="select-none touch-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: isMobile ? 10 : 0,
                  right: isMobile ? 0 : 20,
                  top: 10,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient id="colorPriceFullscreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  ticks={xAxisTicks}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  stroke="hsl(var(--text-muted))"
                  tickFormatter={formatXAxisLabel}
                  tick={{ style: { fontSize: isMobile ? '10px' : '11px', fill: 'hsl(var(--text-muted))' } }}
                  label={{ value: "WIB", position: "insideBottomRight", offset: -5, style: { fontSize: '10px', fill: 'hsl(var(--text-muted))', fontWeight: 600 } }}
                />
                <YAxis 
                  domain={[Math.max(0, minPrice - padding), maxPrice + padding]}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  tickMargin={8}
                  stroke="hsl(var(--text-muted))"
                  tickFormatter={formatPriceYAxis}
                  width={isMobile ? 65 : 80}
                  orientation={isMobile ? "right" : "left"}
                  tick={{ style: { fontSize: isMobile ? '10px' : '11px', fill: 'hsl(var(--text-muted))' } }}
                  tickCount={8}
                />
                <Tooltip
                  cursor={{ stroke: color, strokeDasharray: '4 4', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const formattedDate = timeframe === "1D"
                        ? new Date(label!).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })
                        : new Date(label!).toLocaleDateString("id-ID", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                      return (
                        <div 
                          style={{
                            background: "rgba(255, 255, 255, 0.9)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(0, 0, 0, 0.08)",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div style={{ fontSize: "0.78rem", color: "hsl(var(--text-secondary))", marginBottom: 2, fontWeight: 500 }}>
                            {formattedDate}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: color }}>
                            {formatPriceYAxis(payload[0].value as number)}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  dataKey="price"
                  type="linear"
                  stroke={color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPriceFullscreen)"
                  activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "#fff" }}
                />
                {chartData.length > 0 && (
                  <ReferenceLine
                    y={chartData[chartData.length - 1].price}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    label={
                      <CustomYAxisBadge 
                        fill={color} 
                        labelText={formatPriceYAxis(chartData[chartData.length - 1].price)} 
                        orientation={isMobile ? "right" : "left"} 
                      />
                    }
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
