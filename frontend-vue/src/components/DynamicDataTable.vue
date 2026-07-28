<template>
  <div class="dynamic-data">
    <div class="table-summary">
      <span>{{ rowCountLabel }}</span>
      <span v-if="model.source">
        Coleccion: <code>{{ model.source }}</code>
      </span>
    </div>

    <div
      v-if="model.rows.length && model.columns.length"
      class="table-scroll"
    >
      <table class="dynamic-table">
        <thead>
          <tr>
            <th
              v-for="column in model.columns"
              :key="column"
              :title="column"
            >
              {{ columnLabel(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in model.rows"
            :key="rowKey(row, rowIndex)"
          >
            <td
              v-for="column in model.columns"
              :key="column"
            >
              <details v-if="isComplex(row[column])">
                <summary>{{ complexSummary(row[column]) }}</summary>
                <pre>{{ prettyValue(row[column]) }}</pre>
              </details>
              <span v-else>{{ primitiveValue(row[column]) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p
      v-else
      class="empty-result"
    >
      La consulta no devolvio registros.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type DataRow = Record<string, unknown>

interface TableModel {
  columns: string[]
  rows: DataRow[]
  source: string | null
}

const props = defineProps<{ data: unknown }>()

const COLLECTION_KEYS = [
  'items',
  'data',
  'results',
  'records',
  'rows',
  'content',
  'products',
  'orders',
]
const OBJECT_KEYS = ['report', 'summary', 'data', 'result', 'payload']
const ROW_KEY_FIELDS = ['id', 'uuid', 'sku', 'code', 'key']

const isRecord = (value: unknown): value is DataRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function rowsFromArray(values: unknown[]): DataRow[] {
  return values.map((value) => (isRecord(value) ? value : { value }))
}

function findCollection(record: DataRow): { values: unknown[]; source: string } | null {
  for (const key of COLLECTION_KEYS) {
    if (Array.isArray(record[key])) {
      return { values: record[key], source: key }
    }
  }

  const firstArray = Object.entries(record).find(([, value]) => Array.isArray(value))
  return firstArray
    ? { values: firstArray[1] as unknown[], source: firstArray[0] }
    : null
}

function buildModel(value: unknown): TableModel {
  let rows: DataRow[]
  let source: string | null = null

  if (Array.isArray(value)) {
    rows = rowsFromArray(value)
  } else if (isRecord(value)) {
    const collection = findCollection(value)
    if (collection) {
      rows = rowsFromArray(collection.values)
      source = collection.source
    } else {
      const objectEntry = OBJECT_KEYS
        .map((key) => [key, value[key]] as const)
        .find(([, entryValue]) => isRecord(entryValue))

      if (objectEntry && isRecord(objectEntry[1])) {
        const isSummary = ['report', 'summary'].includes(objectEntry[0])
        const nestedCollection = isSummary ? null : findCollection(objectEntry[1])
        if (nestedCollection) {
          rows = rowsFromArray(nestedCollection.values)
          source = `${objectEntry[0]}.${nestedCollection.source}`
        } else {
          rows = [objectEntry[1]]
          source = objectEntry[0]
        }
      } else {
        rows = [value]
      }
    }
  } else if (value === null || value === undefined) {
    rows = []
  } else {
    rows = [{ value }]
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return { columns, rows, source }
}

const model = computed(() => buildModel(props.data))
const rowCountLabel = computed(() => {
  const count = model.value.rows.length
  return `${count} ${count === 1 ? 'registro' : 'registros'}`
})

function columnLabel(column: string) {
  const acronyms = new Set(['api', 'id', 'ip', 'sku', 'url', 'uuid'])
  const words = column
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)

  return words
    .map((word) => {
      if (acronyms.has(word.toLowerCase())) return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function isComplex(value: unknown) {
  return typeof value === 'object' && value !== null
}

function complexSummary(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} ${value.length === 1 ? 'elemento' : 'elementos'}`
  }
  return `${Object.keys(value as DataRow).length} campos`
}

function prettyValue(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function primitiveValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Si' : 'No'
  return String(value)
}

function rowKey(row: DataRow, index: number) {
  for (const field of ROW_KEY_FIELDS) {
    const value = row[field]
    if (typeof value === 'string' || typeof value === 'number') {
      return `${field}-${value}`
    }
  }
  return `row-${index}`
}
</script>

<style scoped>
.dynamic-data {
  min-width: 0;
}

.table-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.table-summary code {
  color: #0f766e;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
}

.dynamic-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  color: #1e293b;
  background: #ffffff;
}

.dynamic-table th {
  position: sticky;
  top: 0;
  padding: 12px 14px;
  color: #475569;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  font-weight: 800;
  text-align: left;
  white-space: nowrap;
}

.dynamic-table td {
  max-width: 360px;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
  overflow-wrap: anywhere;
  vertical-align: top;
}

.dynamic-table tbody tr:last-child td {
  border-bottom: 0;
}

.dynamic-table tbody tr:hover {
  background: #f8fafc;
}

.dynamic-table details summary {
  color: #0f766e;
  cursor: pointer;
  font-weight: 700;
}

.dynamic-table pre {
  max-width: 340px;
  max-height: 240px;
  margin: 8px 0 0;
  padding: 10px;
  overflow: auto;
  color: #e2e8f0;
  background: #172033;
  border-radius: 6px;
  font-size: 12px;
  white-space: pre-wrap;
}

.empty-result {
  margin: 0;
  padding: 24px 12px;
  color: #64748b;
  text-align: center;
}

@media (max-width: 720px) {
  .table-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
