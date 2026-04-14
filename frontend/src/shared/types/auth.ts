type UserRole = 'public' | 'supermarket' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  food_bank_id?: number | null
  food_bank_name?: string | null
}
