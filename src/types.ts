export type Options = {
  db?: string
  url?: string
  out: string
  json?: string
  email?: string
  password?: string
}

export type FieldSchema = {
  id: string
  name: string
  type:
    | "text"
    | "file"
    | "text"
    | "number"
    | "bool"
    | "email"
    | "url"
    | "date"
    | "select"
    | "json"
    | "relation"
    | "user"
  system: boolean
  required: boolean
  unique: boolean
  options: RecordOptions
}

export type CollectionRecord = {
  id: string
  type: "base" | "auth"
  name: string
  system: boolean
  listRule: string | null
  viewRule: string | null
  createRule: string | null
  updateRule: string | null
  deleteRule: string | null
  schema: Array<FieldSchema>
  options?: CollectionOptions
}

export type CollectionOptions = {
  allowEmailAuth?: boolean
  allowOAuth2Auth?: boolean
  allowUsernameAuth?: boolean
  exceptEmailDomains?: string[] | null
  manageRule?: string | null
  minPasswordLength?: number
  onlyEmailDomains?: string[] | null
  requireEmail?: boolean
}

// Every field is optional
export type RecordOptions = {
  maxSelect?: number | null
  min?: number | null
  max?: number | null
  pattern?: string
  values?: string[] | null
  collectionId?: string
  cascadeDelete?: boolean
  allowEmailAuth?: boolean
  allowOAuth2Auth?: boolean
  allowUsernameAuth?: boolean
  exceptEmailDomains?: string[] | null
  manageRule?: any
  minPasswordLength?: number
  onlyEmailDomains?: string[] | null
  requireEmail?: boolean
}
