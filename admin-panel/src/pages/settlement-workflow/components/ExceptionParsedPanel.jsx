import ExceptionValueGrid from './ExceptionValueGrid'

export default function ExceptionParsedPanel({ fields, data }) {
  return <ExceptionValueGrid title="Original Parsed Values" fields={fields} data={data} />
}
