import { render } from 'preact'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById('app') as HTMLElement
)
