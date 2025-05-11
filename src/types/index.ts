// 匹配结果类型
export interface MatchResult {
  id: string | number
  name?: string
  artist?: string
  url: string
  [key: string]: any
}

// API响应类型
export interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}
