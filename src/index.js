/** @jsxRuntime classic */
import { jsx } from 'react'
import MyReact from './MyReact'

const container = document.querySelector('#root')

/** @jsx MyReact.createElement */

function App() {
  const [number, setNumber] = MyReact.useState(1)
  const [visibile, setVisibile] = MyReact.useState(true)
  return (
    <div>
      <button
        onClick={() => {
          setNumber(number + 1)
          setVisibile(!visibile)
        }}
      >
        按钮
      </button>
      <h1>{number}</h1>
      {visibile ? <h2>你看到我了吗？</h2> : null}
    </div>
  )
}

MyReact.render(<App />, container)
