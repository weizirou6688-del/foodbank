import { useEffect, useMemo, useState } from 'react'

export const buildFilterOptions = (values: Iterable<string>) =>
  Array.from(new Set(values))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }))

export function usePagination<T>(rows: T[], pageSize: number, resetKey: string) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [page, pageSize, rows])

  return { page, setPage, totalPages, pageRows }
}
