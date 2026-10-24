export type Contact = {
  id: string
  user_id?: string
  folder_id?: string | null
  name: string
  phone?: string | null
  email?: string | null
  note?: string | null
  created_at?: string
  updated_at?: string
}

export type Folder = {
  id: string
  user_id?: string
  name: string
  color?: string | null
  created_at?: string
  updated_at?: string
}

export type DebtDirection = 'they_owe_me' | 'i_owe_them'
export type DebtStatus = 'pending' | 'partial' | 'paid'

export type Debt = {
  id: string
  user_id?: string
  contact_id: string
  direction: DebtDirection
  amount: number
  currency: string
  description?: string | null
  due_date?: string | null
  status: DebtStatus
  created_at?: string
  updated_at?: string
}

export type Payment = {
  id: string
  debt_id?: string
  user_id?: string
  amount: number
  note?: string | null
  paid_at: string
  created_at?: string
}

export type ContactInput = {
  name: string
  phone?: string
  email?: string
  note?: string
  folder_id?: string
}

export type FolderInput = {
  name: string
  color?: string
}

export type DebtInput = {
  contact_id: string
  direction: DebtDirection
  amount: number
  currency?: string
  description?: string
  due_date?: string
  status?: DebtStatus
}

export type PaymentInput = {
  amount: number
  note?: string
}

export type PaymentsMap = Record<string, Payment[]>

export type CurrentUser = {
  id: string
  name: string
  email: string
  created_at?: string
}
