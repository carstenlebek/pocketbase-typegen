import {
  ALIAS_TYPE_DEFINITIONS,
  AUTH_SYSTEM_FIELDS_DEFINITION,
  BASE_SYSTEM_FIELDS_DEFINITION,
  DATE_STRING_TYPE_NAME,
  EXPORT_COMMENT,
  RECORD_ID_STRING_NAME,
  RECORD_TYPE_COMMENT,
  RESPONSE_TYPE_COMMENT,
} from "./constants"
import { CollectionRecord, FieldSchema } from "./types"
import {
  fieldNameToGeneric,
  getGenericArgString,
  getGenericArgStringWithDefault,
} from "./generics"
import {
  getOptionEnumName,
  getOptionValues,
  getSystemFields,
  sanitizeFieldName,
  toPascalCase,
} from "./utils"

const pbSchemaTypescriptMap = {
  text: "string",
  number: "number",
  bool: "boolean",
  email: "string",
  url: "string",
  date: DATE_STRING_TYPE_NAME,
  select: (fieldSchema: FieldSchema, collectionName: string) => {
    // pocketbase v0.8+ values are required
    const valueType = fieldSchema.options.values
      ? getOptionEnumName(collectionName, fieldSchema.name)
      : "string"
    return fieldSchema.options.maxSelect && fieldSchema.options.maxSelect > 1
      ? `${valueType}[]`
      : valueType
  },
  json: (fieldSchema: FieldSchema) =>
    `null | ${fieldNameToGeneric(fieldSchema.name)}`,
  file: (fieldSchema: FieldSchema) =>
    fieldSchema.options.maxSelect && fieldSchema.options.maxSelect > 1
      ? "string[]"
      : "string",
  relation: (fieldSchema: FieldSchema) =>
    fieldSchema.options.maxSelect && fieldSchema.options.maxSelect === 1
      ? RECORD_ID_STRING_NAME
      : `${RECORD_ID_STRING_NAME}[]`,
  // DEPRECATED: PocketBase v0.8 does not have a dedicated user relation
  user: (fieldSchema: FieldSchema) =>
    fieldSchema.options.maxSelect && fieldSchema.options.maxSelect > 1
      ? `${RECORD_ID_STRING_NAME}[]`
      : RECORD_ID_STRING_NAME,
}

export function generate(results: Array<CollectionRecord>) {
  const collectionNames: Array<string> = []
  const recordTypes: Array<string> = []
  const responseTypes: Array<string> = [RESPONSE_TYPE_COMMENT]

  results
    .sort((a, b) => {
      if (a.name < b.name) {
        return -1
      }
      if (a.name > b.name) {
        return 1
      }
      return 0
    })
    .forEach((row) => {
      if (row.name) collectionNames.push(row.name)
      if (row.schema) {
        recordTypes.push(createRecordType(row.name, row.schema))
        responseTypes.push(createResponseType(row, results))
      }
    })
  const sortedCollectionNames = collectionNames

  const fileParts = [
    EXPORT_COMMENT,
    createCollectionEnum(sortedCollectionNames),
    ALIAS_TYPE_DEFINITIONS,
    BASE_SYSTEM_FIELDS_DEFINITION,
    AUTH_SYSTEM_FIELDS_DEFINITION,
    RECORD_TYPE_COMMENT,
    ...recordTypes,
    responseTypes.join("\n"),
    createCollectionRecords(sortedCollectionNames),
  ]

  return fileParts.join("\n\n")
}

export function createCollectionEnum(collectionNames: Array<string>) {
  const collections = collectionNames
    .map((name) => `\t${toPascalCase(name)} = "${name}",`)
    .join("\n")
  const typeString = `export enum Collections {
${collections}
}`
  return typeString
}

export function createCollectionRecords(collectionNames: Array<string>) {
  const nameRecordMap = collectionNames
    .map((name) => `\t${name}: ${toPascalCase(name)}Record`)
    .join("\n")
  return `export type CollectionRecords = {
${nameRecordMap}
}`
}

export function createRecordType(
  name: string,
  schema: Array<FieldSchema>
): string {
  const selectOptionEnums = createSelectOptions(name, schema)
  const typeName = toPascalCase(name)
  const genericArgs = getGenericArgStringWithDefault(schema)
  const fields = schema
    .map((fieldSchema: FieldSchema) => createTypeField(name, fieldSchema))
    .join("\n")

  return `${selectOptionEnums}export type ${typeName}Record${genericArgs} = {
${fields}
}`
}

export function createResponseType(
  collectionSchemaEntry: CollectionRecord,
  collectionSchema: CollectionRecord[]
) {
  const { name, schema, type } = collectionSchemaEntry
  const pascaleName = toPascalCase(name)
  const genericArgsWithDefaults = getGenericArgStringWithDefault(schema)
  const genericArgs = getGenericArgString(schema)
  const systemFields = getSystemFields(type)

  const expandFields = schema
    .filter((fieldSchema: FieldSchema) => fieldSchema.type === "relation")
    .map((fieldSchema: FieldSchema) => {
      const expandCollection = collectionSchema.find(
        (collectionSchemaEntry) =>
          collectionSchemaEntry.id === fieldSchema.options.collectionId
      )
      if (!expandCollection) {
        throw new Error(
          `could not find collection with id ${fieldSchema.options.collectionId}`
        )
      }
      const { name, schema } = expandCollection
      const pascaleName = toPascalCase(name)
      const genericArgsWithDefaults = getGenericArgStringWithDefault(schema)

      return createExpandField(
        pascaleName,
        fieldSchema,
        genericArgsWithDefaults
      )
    })

  return `export type ${pascaleName}Response${genericArgsWithDefaults} = ${pascaleName}Record${genericArgs} & ${systemFields} ${
    expandFields.length > 0
      ? `& {\n\texpand?: {\n${expandFields.join("\n")}\n\t}\n}`
      : ""
  }`
}

export function createTypeField(
  collectionName: string,
  fieldSchema: FieldSchema
) {
  if (!(fieldSchema.type in pbSchemaTypescriptMap)) {
    throw new Error(`unknown type ${fieldSchema.type} found in schema`)
  }
  const typeStringOrFunc =
    pbSchemaTypescriptMap[
      fieldSchema.type as keyof typeof pbSchemaTypescriptMap
    ]

  const typeString =
    typeof typeStringOrFunc === "function"
      ? typeStringOrFunc(fieldSchema, collectionName)
      : typeStringOrFunc

  const fieldName = sanitizeFieldName(fieldSchema.name)
  const required = fieldSchema.required ? "" : "?"

  return `\t${fieldName}${required}: ${typeString}`
}

export function createExpandField(
  pascaleName: string,
  fieldSchema: FieldSchema,
  genericArgsWithDefaults: string
) {
  const fieldName = sanitizeFieldName(fieldSchema.name)
  const required = fieldSchema.required ? "" : "?"

  const typeString =
    fieldSchema.options.maxSelect && fieldSchema.options.maxSelect === 1
      ? `${pascaleName}Response${genericArgsWithDefaults}`
      : `Array<${pascaleName}Response${genericArgsWithDefaults}>`

  return `\t\t${fieldName}${required}: ${typeString}`
}

export function createSelectOptions(
  recordName: string,
  schema: Array<FieldSchema>
) {
  const selectFields = schema.filter((field) => field.type === "select")
  const typestring = selectFields
    .map(
      (field) => `export enum ${getOptionEnumName(recordName, field.name)} {
${getOptionValues(field)
  .map((val) => `\t"${val}" = "${val}",`)
  .join("\n")}
}\n`
    )
    .join("\n")
  return typestring
}
