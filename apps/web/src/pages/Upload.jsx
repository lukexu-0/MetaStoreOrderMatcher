import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import config from "../utils/config"

const CurrentSheets = ({ refreshToken }) => {
  const [sheets, setSheets] = useState([])
  useEffect(() => {
    let isMounted = true

    const fetchSheets = async () => {
      try {
        const response = await fetch(`${config.BACKEND_URL}/inventory/spreadsheets`, {
          credentials: "include"
        })
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }
        const data = await response.json()
        if (isMounted) {
          const nextSheets = Array.isArray(data) ? data : []
          const sorted = [...nextSheets].sort((a, b) => {
            const aTime = a?.month ? Date.parse(a.month) : Number.NEGATIVE_INFINITY
            const bTime = b?.month ? Date.parse(b.month) : Number.NEGATIVE_INFINITY
            return bTime - aTime
          })
          setSheets(sorted)
        }
      } catch (error) {
        if (isMounted) {
          setSheets([])
        }
      }
    }

    fetchSheets()

    return () => {
      isMounted = false
    }
  }, [refreshToken])

  const extractYearMonth = (monthValue) => {
    if (!monthValue) return null
    const parts = String(monthValue).split("-")
    if (parts.length < 2) return null
    const yearNum = Number.parseInt(parts[0], 10)
    const monthNum = Number.parseInt(parts[1], 10)
    if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum)) return null
    if (yearNum < 1000 || yearNum > 9999 || monthNum < 1 || monthNum > 12) return null
    return {
      year: String(yearNum).padStart(4, "0"),
      month: String(monthNum).padStart(2, "0")
    }
  }

  const handleDelete = async (sheet) => {
    const yearMonth = extractYearMonth(sheet?.month)
    if (!yearMonth) return
    try {
      const response = await fetch(`${config.BACKEND_URL}/inventory/${yearMonth.year}/${yearMonth.month}`, {
        method: "DELETE",
        credentials: "include"
      })
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }
      setSheets((prev) => prev.filter((entry) => entry?.month !== sheet?.month))
    } catch (error) {
      // no-op for now
    }
  }

  return (
    <div>
      <h3>Current Sheets</h3>
      <div>
        {sheets.map((sheet) => (
          <div key={sheet.id ?? sheet.month}>
            <span>
              {sheet.source_name ?? "Unnamed file"}
              {" — "}
              {sheet.month ? sheet.month.slice(0, 7) : "Unknown month"}
            </span>
            <button onClick={() => handleDelete(sheet)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const Upload = () =>{
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const canUpload = Boolean(selectedFile && selectedMonth && !isUploading)

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] ?? null)
  }

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value)
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedMonth || isUploading) return
    const [year, month] = selectedMonth.split("-")
    if (!year || !month) return

    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      setIsUploading(true)
      const response = await fetch(`${config.BACKEND_URL}/upload/${year}/${month}`, {
        method: "POST",
        credentials: "include",
        body: formData
      })
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }
      setRefreshToken((value) => value + 1)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      // no-op for now
    } finally {
      setIsUploading(false)
    }
  }

  return(
    <>
    <div>
      <button onClick={() => navigate("/home")}>Home</button>
      <input ref={fileInputRef} type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!canUpload}>
        Upload File
      </button>
      <div>
        <label>
          Month
          <input type="month" value={selectedMonth} onChange={handleMonthChange} />
        </label>
      </div>
    </div>
    <CurrentSheets refreshToken={refreshToken} />
    </>
  )
}

export default Upload
